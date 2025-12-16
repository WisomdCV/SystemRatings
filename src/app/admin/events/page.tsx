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
    if (!["DEV", "PRESIDENT", "DIRECTOR", "SUBDIRECTOR", "TREASURER"].includes(role)) {
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
        // Fetch MD Area ID globally as it's needed for multiple roles
        const mdArea = await db.query.areas.findFirst({
            where: eq(areas.code, "MD"),
            columns: { id: true }
        });

        // A. Admin (DEV/PRESIDENT): Fetch ALL events and ALL areas
        if (role === "DEV" || role === "PRESIDENT") {
            eventsData = await db.query.events.findMany({
                where: eq(events.semesterId, activeSemester.id),
                orderBy: [desc(events.date)],
                with: {
                    targetArea: true,
                    createdBy: { columns: { name: true, role: true } }
                }
            });
            areasList = await db.select({ id: areas.id, name: areas.name }).from(areas);
        }

        // B. Treasurer: Fetch General + MD Only
        else if (role === "TREASURER") {
            const visibilityConditions = [isNull(events.targetAreaId)]; // General
            if (mdArea) visibilityConditions.push(eq(events.targetAreaId, mdArea.id)); // MD

            eventsData = await db.query.events.findMany({
                where: and(
                    eq(events.semesterId, activeSemester.id),
                    or(...visibilityConditions)
                ),
                orderBy: [desc(events.date)],
                with: {
                    targetArea: true,
                    createdBy: { columns: { name: true, role: true } }
                }
            });
            // Treasurer might need areas list if allowed to create MD/General events?
            // The prompt says "Permítele elegir entre General y Mesa Directiva".
            // So we need to provide MD in areasList or handle it in Form.
            if (mdArea) areasList = await db.select({ id: areas.id, name: areas.name }).from(areas).where(eq(areas.code, "MD"));
        }

        // C. Director/Subdirector: Fetch Own Events + General Events + BOARD (MD) Events
        else if (role === "DIRECTOR" || role === "SUBDIRECTOR") {
            // Fetch Area Name
            if (currentAreaId) {
                const areaObj = await db.query.areas.findFirst({
                    where: eq(areas.id, currentAreaId),
                    columns: { name: true }
                });
                if (areaObj) userAreaName = areaObj.name;
            }

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
                    createdBy: { columns: { name: true, role: true } }
                }
            });
        }
    }

    return (
        <div className="p-6 lg:p-10 min-h-screen bg-meteorite-50 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

            <div className="relative z-10">
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
        </div>
    );
}

import NewEventModal from "@/components/events/NewEventModal";
