
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getAttendanceSheetAction } from "@/server/actions/attendance.actions";
import AttendanceTracker from "@/components/attendance/AttendanceTracker";
import { ArrowLeft, Calendar } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";

type Params = Promise<{ id: string }>;

interface AttendancePageProps {
    params: Params;
}

export default async function AttendancePage({ params }: AttendancePageProps) {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const { id: eventId } = await params;

    // Fetch basic event info for Header (Separate from sheet action to ensure we have title)
    // Could also get it from sheet action if revised, but safer to get purely here.
    const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
            title: true,
            date: true,
            targetAreaId: true
        }
    });

    if (!event) {
        return (
            <div className="p-10 text-center">
                <h1 className="text-2xl font-bold text-red-500">Evento no encontrado</h1>
                <Link href="/admin/events" className="text-blue-500 hover:underline mt-4 block">Volver a eventos</Link>
            </div>
        );
    }

    const { success, data, error } = await getAttendanceSheetAction(eventId);

    if (!success || !data) {
        return (
            <div className="p-10 text-center">
                <h1 className="text-2xl font-bold text-red-500">Acceso Denegado o Error</h1>
                <p className="text-gray-600 mt-2 text-lg">{error || "No se pudo cargar la hoja de asistencia."}</p>
                <Link href="/admin/events" className="text-blue-500 hover:underline mt-6 block font-bold">Volver a la lista de eventos</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-8 pb-32">
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

            <div className="relative z-10 max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/admin/events" className="inline-flex items-center text-sm font-bold text-meteorite-500 hover:text-meteorite-700 transition-colors mb-4">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Volver a Eventos
                    </Link>
                    <div className="bg-white/80 backdrop-blur-sm border border-meteorite-100 p-6 rounded-2xl shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-3xl font-black text-meteorite-950 mb-2">{event.title}</h1>
                                <div className="flex items-center text-meteorite-600 font-medium">
                                    <Calendar className="w-5 h-5 mr-2" />
                                    <span>{new Date(event.date).toLocaleDateString('es-ES', { dateStyle: 'full', timeZone: 'UTC' })}</span>
                                </div>
                            </div>
                            <div className="px-3 py-1 bg-meteorite-100 text-meteorite-700 font-bold rounded-lg text-xs uppercase tracking-wider">
                                {event.targetAreaId ? "Evento de Área" : "Evento General"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tracker */}
                <AttendanceTracker eventId={eventId} initialSheet={data} />
            </div>
        </div>
    );
}
