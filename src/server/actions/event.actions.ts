"use server";

import { auth } from "@/server/auth";
import { CreateEventDTO, CreateEventSchema } from "@/lib/validators/event";
import { createGoogleMeeting } from "@/server/services/google-calendar.service";
import { createEventDAO, getEventByIdDAO, updateEventDAO, deleteEventDAO } from "@/server/data-access/events";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projectMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
    canCreateIISEEvent,
    canCreateProjectEvent,
    canManageEvent,
    canTargetAnyArea,
    shouldTrackAttendance,
    type EventScope,
    type EventType,
} from "@/server/services/event-permissions.service";
import { UpdateEventDTO, UpdateEventSchema } from "@/lib/validators/event";
import { deleteGoogleEvent, updateGoogleEvent } from "@/server/services/google-calendar.service";

function normalizeRoleName(value: string | null | undefined): string {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

async function getTreasurySpecialInvitees(projectId: string): Promise<string[]> {
    const members = await db.query.projectMembers.findMany({
        where: eq(projectMembers.projectId, projectId),
        with: {
            projectRole: { columns: { name: true } },
            user: { columns: { id: true } },
        },
    });

    return members
        .filter((member) => normalizeRoleName(member.projectRole?.name) === "director de area")
        .map((member) => member.user.id);
}

export async function createEventAction(input: CreateEventDTO) {
    try {
        // 1. Auth & Validation
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "No autenticado" };
        }

        const validated = CreateEventSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: validated.error.issues[0].message };
        }
        const data = validated.data;

        // 2. Permission check via centralized engine
        const role = session.user.role;
        const eventScope = data.eventScope as EventScope;
        const eventType = data.eventType as EventType;

        // General events are never area-targeted.
        if (eventType === "GENERAL") {
            data.targetAreaId = null;
            data.targetProjectAreaId = null;
        }

        // Invitee-based events are not area-target driven.
        // Normalize hidden form leftovers so visibility is consistent for invitees.
        if (eventType === "INDIVIDUAL_GROUP" || eventType === "TREASURY_SPECIAL") {
            data.targetAreaId = null;
            data.targetProjectAreaId = null;
        }

        if (eventScope === "IISE") {
            const canCreate = await canCreateIISEEvent(
                {
                    userRole: role,
                    userAreaId: session.user.currentAreaId,
                    customPermissions: session.user.customPermissions,
                },
                eventType,
                data.targetAreaId,
            );
            if (!canCreate) {
                return { success: false, error: "No tienes permisos para crear este tipo de evento." };
            }

            // For AREA events: if user cannot target any area, force their own area
            if (eventType === "AREA" && !canTargetAnyArea({
                userRole: role,
                userAreaId: session.user.currentAreaId,
                customPermissions: session.user.customPermissions,
            })) {
                data.targetAreaId = session.user.currentAreaId;
            }
        } else if (eventScope === "PROJECT") {
            if (!data.projectId) {
                return { success: false, error: "Se requiere un proyecto para este tipo de evento." };
            }
            const canCreate = await canCreateProjectEvent(
                {
                    userRole: role,
                    userAreaId: session.user.currentAreaId,
                    customPermissions: session.user.customPermissions,
                    projectId: data.projectId,
                    userId: session.user.id,
                },
                eventType,
                data.targetProjectAreaId,
            );
            if (!canCreate) {
                return { success: false, error: "No tienes permisos para crear eventos en este proyecto." };
            }

            // Treasury special meetings always target project area directors automatically.
            if (eventType === "TREASURY_SPECIAL") {
                const invitees = await getTreasurySpecialInvitees(data.projectId);
                if (invitees.length === 0) {
                    return { success: false, error: "No hay directores de área en este proyecto para convocar la reunión especial." };
                }
                data.eventScope = "PROJECT";
                data.targetAreaId = null;
                data.targetProjectAreaId = null;
                data.inviteeUserIds = invitees;
            }
        }

        // 3. TIMEZONE FIX
        data.date = new Date(data.date.getUTCFullYear(), data.date.getUTCMonth(), data.date.getUTCDate());

        // 4. Google Calendar Integration
        if (!session.accessToken) {
            return { success: false, error: "Google Token Expired. Por favor relogueate." };
        }

        let googleResult = { googleId: "manual-" + Date.now(), meetLink: null as string | null };

        try {
            const googleResponse = await createGoogleMeeting(session.accessToken, data);
            googleResult = {
                googleId: googleResponse.googleId,
                meetLink: googleResponse.meetLink || null
            };
        } catch (error: any) {
            console.error("Google API Error:", error);
            return { success: false, error: "Error conectando con Google Calendar: " + error.message };
        }

        // 5. Persistence
        const tracksAttendance = shouldTrackAttendance(eventType);
        await createEventDAO(session.user.id, data, googleResult, tracksAttendance);

        // 6. Revalidate
        revalidatePath("/dashboard");
        revalidatePath("/admin/events");
        if (data.projectId) {
            revalidatePath(`/dashboard/projects/${data.projectId}`);
        }

        return { success: true, message: "Evento creado y sincronizado correctamente." };

    } catch (err: any) {
        console.error("Create Event Action Error:", err);
        return { success: false, error: err.message || "Error interno del servidor" };
    }
}

export async function deleteEventAction(eventId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "No autenticado" };

        const event = await getEventByIdDAO(eventId);
        if (!event) return { success: false, error: "Evento no encontrado" };

        // Permissions via centralized engine
        const canManage = await canManageEvent(
            {
                userRole: session.user.role,
                userId: session.user.id,
                userAreaId: session.user.currentAreaId,
                customPermissions: session.user.customPermissions,
            },
            {
                createdById: event.createdById,
                eventScope: event.eventScope,
                eventType: event.eventType,
                targetAreaId: event.targetAreaId,
                projectId: event.projectId,
                targetProjectAreaId: event.targetProjectAreaId,
            }
        );

        if (!canManage) {
            return { success: false, error: "No tienes permisos para eliminar este evento." };
        }

        // Google Sync (Delete)
        let warning = "";
        if (event.googleEventId && session.accessToken) {
            try {
                await deleteGoogleEvent(session.accessToken, event.googleEventId);
            } catch (err: any) {
                console.error("Google Delete Error:", err);
                warning = " Nota: No se pudo eliminar de Google Calendar.";
            }
        } else if (event.googleEventId && !session.accessToken) {
            warning = " Nota: No se pudo conectar con Google (Sesión expirada).";
        }

        await deleteEventDAO(eventId);

        revalidatePath("/dashboard");
        revalidatePath("/admin/events");

        return { success: true, message: "Evento eliminado." + warning };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateEventAction(eventId: string, input: UpdateEventDTO) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "No autenticado" };

        const event = await getEventByIdDAO(eventId);
        if (!event) return { success: false, error: "Evento no encontrado" };

        // Permissions via centralized engine
        const canManage = await canManageEvent(
            {
                userRole: session.user.role,
                userId: session.user.id,
                userAreaId: session.user.currentAreaId,
                customPermissions: session.user.customPermissions,
            },
            {
                createdById: event.createdById,
                eventScope: event.eventScope,
                eventType: event.eventType,
                targetAreaId: event.targetAreaId,
                projectId: event.projectId,
                targetProjectAreaId: event.targetProjectAreaId,
            }
        );

        if (!canManage) {
            return { success: false, error: "No tienes permisos para editar este evento." };
        }

        const validated = UpdateEventSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: validated.error.issues[0].message };
        }
        const data = validated.data;

        const effectiveEventType = (data.eventType ?? event.eventType) as EventType;
        const effectiveEventScope = (data.eventScope ?? event.eventScope) as EventScope;
        const effectiveProjectId = data.projectId ?? event.projectId;

        // Keep scope/type target fields consistent even if the client sends stale hidden values.
        if (effectiveEventType === "GENERAL") {
            data.targetAreaId = null;
            data.targetProjectAreaId = null;
        } else if (effectiveEventType === "AREA") {
            if (effectiveEventScope === "IISE") {
                data.targetProjectAreaId = null;
            }
            if (effectiveEventScope === "PROJECT") {
                data.targetAreaId = null;
            }
        }

        // Keep invitee-based target fields normalized when editing.
        if (effectiveEventType === "INDIVIDUAL_GROUP" || effectiveEventType === "TREASURY_SPECIAL") {
            data.targetAreaId = null;
            data.targetProjectAreaId = null;
        }

        if (effectiveEventType === "TREASURY_SPECIAL") {
            if (!effectiveProjectId) {
                return { success: false, error: "La reunión especial de tesorería requiere un proyecto." };
            }

            const invitees = await getTreasurySpecialInvitees(effectiveProjectId);
            if (invitees.length === 0) {
                return { success: false, error: "No hay directores de área en este proyecto para convocar la reunión especial." };
            }

            data.eventScope = "PROJECT";
            data.eventType = "TREASURY_SPECIAL";
            data.projectId = effectiveProjectId;
            data.inviteeUserIds = invitees;
        }

        // TIMEZONE FIX
        if (data.date) {
            data.date = new Date(data.date.getUTCFullYear(), data.date.getUTCMonth(), data.date.getUTCDate());
        }

        // Google Sync (Update)
        const needsGoogleUpdate = data.title || data.description || (data.date && data.startTime && data.endTime);
        let warning = "";

        if (event.googleEventId && needsGoogleUpdate) {
            if (session.accessToken) {
                try {
                    await updateGoogleEvent(session.accessToken, event.googleEventId, data);
                } catch (err: any) {
                    console.error("Google Update Error:", err);
                    warning = " Nota: Cambios guardados localmente, pero falló la sincro con Google.";
                }
            } else {
                warning = " Nota: Sin conexión a Google (Token expirado), cambios solo locales.";
            }
        }

        await updateEventDAO(eventId, data);

        revalidatePath("/dashboard");
        revalidatePath("/admin/events");

        return { success: true, message: "Evento actualizado." + warning };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
