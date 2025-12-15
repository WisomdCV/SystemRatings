import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getMyAttendanceHistoryAction } from "@/server/actions/attendance.actions";
import AttendanceList from "@/components/attendance/AttendanceList";
import { CalendarCheck2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function StudentAttendancePage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const { success, data, error } = await getMyAttendanceHistoryAction();

    if (!success) {
        return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 lg:p-10">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <Link href="/dashboard" className="inline-flex items-center text-sm font-bold text-gray-400 hover:text-meteorite-600 transition-colors mb-4">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Volver al Dashboard
                    </Link>
                    <h1 className="text-3xl font-black text-meteorite-950 flex items-center">
                        <CalendarCheck2 className="mr-3 w-8 h-8 text-meteorite-600" />
                        Mis Asistencias
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Historial de asistencias y gestión de justificaciones.
                    </p>
                </div>

                <AttendanceList records={data as any[] || []} />
            </div>
        </div>
    );
}
