import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events, areas, semesters } from "@/db/schema";
import { desc, eq, and, or, isNull } from "drizzle-orm";
import EventsList from "@/components/events/EventsList";
import CreateEventForm from "@/components/events/CreateEventForm";
import { CalendarCheck, Plus, Filter } from "lucide-react";
import Link from "next/link";

export default async function EventsPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const role = session.user.role || "";
    const userId = session.user.id;
    const currentAreaId = session.user.currentAreaId;

    // 1. Role Protection
    if (!["DEV", "PRESIDENT", "DIRECTOR"].includes(role)) {
        return redirect("/dashboard?error=AccessDenied");
    }

    // 2. Fetch Active Semester
    const activeSemester = await db.query.semesters.findFirst({
        where: eq(semesters.isActive, true)
    });

    // 3. Fetch Data based on Role
    let eventsData: any[] = [];
    let areasList: any[] = [];
    let userAreaName: string | null = null;

    if (activeSemester) {
        if (role === "DEV" || role === "PRESIDENT") {
            // A. Admin: Fetch ALL events and ALL areas
            eventsData = await db.query.events.findMany({
                where: eq(events.semesterId, activeSemester.id),
                orderBy: [desc(events.date)],
                with: {
                    targetArea: true,
                    createdBy: {
                        columns: {
                            name: true,
                            role: true
                        }
                    }
                }
            });

            areasList = await db.select({ id: areas.id, name: areas.name }).from(areas);

            // B. Director/Subdirector: Fetch Own Events + General Events + BOARD (MD) Events
            // And fetch their own area name

            // Fetch Area Name
            if (currentAreaId) {
                const areaObj = await db.query.areas.findFirst({
                    where: eq(areas.id, currentAreaId),
                    columns: { name: true }
                });
                if (areaObj) userAreaName = areaObj.name;
            }

            // Fetch MD Area ID to include its events
            const mdArea = await db.query.areas.findFirst({
                where: eq(areas.code, "MD"), // Looking for "Mesa Directiva" by code
                columns: { id: true }
            });

            // Fetch Events
            // Visible:
            // 1. General (targetAreaId IS NULL)
            // 2. My Area (targetAreaId == currentAreaId)
            // 3. Board (targetAreaId == mdArea.id)

            const visibilityConditions = [
                isNull(events.targetAreaId), // General
                eq(events.targetAreaId, currentAreaId || "impossible_id") // Own Area
            ];

            if (mdArea) {
                visibilityConditions.push(eq(events.targetAreaId, mdArea.id));
            }

            eventsData = await db.query.events.findMany({
                where: and(
                    eq(events.semesterId, activeSemester.id),
                    or(...visibilityConditions)
                ),
                orderBy: [desc(events.date)],
                with: {
                    targetArea: true,
                    createdBy: {
                        columns: {
                            name: true,
                            role: true
                        }
                    }
                }
            });
        }
    }

    return (
        <div className="p-6 lg:p-10 min-h-screen bg-meteorite-50/50">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-meteorite-950 flex items-center">
                        <CalendarCheck className="mr-3 w-8 h-8 text-meteorite-600" />
                        Agenda & Eventos
                    </h1>
                    <p className="text-meteorite-600 mt-2 font-medium">
                        Gestión de actividades para el semestre {activeSemester?.name || "Sin Semestre"}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button className="flex items-center px-4 py-2 bg-white border border-meteorite-200 text-meteorite-700 font-bold rounded-xl hover:bg-meteorite-50 transition-colors shadow-sm">
                        <Filter className="w-4 h-4 mr-2" />
                        Filtrar
                    </button>

                    {/* The Prompt asks for a Form in a Modal/Drawer. 
                        For simplicity in this step, we will put the form in a simplified Dialog or just a standard "Create New" section.
                        To make it polished, we can use a Client Component Wrapper for a Dialog/Modal.
                        For now, let's use a standard 'New Event' button that toggles a visible form or similar if requested, 
                        BUT the user asked for "Formulario de Creación... (ej. en un Modal/Drawer)".
                        I will verify if I should implement a Drawer. The user gave me 'CreateEventForm.tsx'. 
                        I will put it inside a <details> or a simple container for now, typically I'd make a 'NewEventButton' client component.
                        Let's use a standard pattern: A "Create" button that behaves as a Trigger for a Dialog.
                        However, since I don't have a UI library installed (shadcn/ui), I will implement a custom 'ModalWrapper' or simply put the form inline for now to ensure functionality first.
                        Wait, the safest bet is to create a Client Component 'NewEventDialog' that wraps 'CreateEventForm'.
                    */}
                    {/* Modal Trigger Component */}
                    <NewEventModal
                        userRole={role}
                        userAreaId={currentAreaId}
                        userAreaName={userAreaName}
                        areas={areasList}
                    />
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="space-y-8">
                <EventsList
                    events={eventsData as any[]}
                    userRole={role}
                    userAreaId={currentAreaId}
                    userAreaName={userAreaName}
                    areas={areasList}
                />
            </div>
        </div>
    );
}

import NewEventModal from "@/components/events/NewEventModal";
