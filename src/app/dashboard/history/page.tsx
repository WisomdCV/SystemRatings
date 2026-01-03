import AttendanceHeatmap from "@/components/dashboard/AttendanceHeatmap";
import { getMyAttendanceHistoryAction } from "@/server/actions/attendance.actions";
import { History, ArrowLeft, CalendarCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AttendanceHistoryPage() {
    const { data: history } = await getMyAttendanceHistoryAction();

    return (
        <div className="p-6 lg:p-10 min-h-screen bg-meteorite-50 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

            <div className="max-w-5xl mx-auto space-y-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-4 border-b border-meteorite-200/50">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="bg-white p-2.5 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100 shrink-0"
                            title="Volver al Dashboard"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black text-meteorite-950 tracking-tight flex items-center gap-3">
                                <History className="w-8 h-8 text-meteorite-600" />
                                Historial de Asistencia
                            </h1>
                            <p className="text-meteorite-600 font-medium mt-1">
                                Visualiza tu nivel de actividad y registro detallado.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Heatmap Section */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-gray-200/40 border border-gray-100">
                    <h2 className="text-xl font-bold mb-6 text-gray-900 flex items-center gap-2">
                        <CalendarCheck className="w-6 h-6 text-meteorite-500" />
                        Mapa de Actividad
                    </h2>
                    <AttendanceHeatmap history={history || []} />
                </div>

                {/* Detailed List Section */}
                <div className="space-y-6">
                    {(Object.entries(
                        (history || []).reduce((acc: any, item: any) => {
                            const cycle = item.event.semester?.name || "Otros";
                            if (!acc[cycle]) acc[cycle] = [];
                            acc[cycle].push(item);
                            return acc;
                        }, {})
                    ) as [string, any[]][])
                        .sort(([cycleA], [cycleB]) => cycleB.localeCompare(cycleA)) // Sort cycles desc (2025-A before 2024-B)
                        .map(([cycleName, items]) => (
                            <div key={cycleName} className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-900 border-l-4 border-meteorite-500 pl-3 sticky top-20">
                                    Ciclo {cycleName}
                                </h2>
                                <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden">
                                    {items
                                        .sort((a: any, b: any) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime())
                                        .map((item: any) => (
                                            <div key={item.id} className="p-5 border-b border-gray-50 last:border-0 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50/50 transition-colors gap-4">
                                                <div>
                                                    <p className="font-bold text-gray-900 text-lg">{item.event.title}</p>
                                                    <p className="text-sm text-gray-500 font-medium flex items-center gap-2 mt-1">
                                                        <span className="capitalize">{new Date(item.event.date).toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'UTC' })}</span>,
                                                        {new Date(item.event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                                                    </p>
                                                </div>
                                                <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide shadow-sm border text-center min-w-[120px] ${item.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                        item.status === 'ABSENT' ? 'bg-red-100 text-red-700 border-red-200' :
                                                            item.status === 'LATE' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                                'bg-blue-100 text-blue-700 border-blue-200'
                                                    }`}>
                                                    {item.status === 'PRESENT' ? 'Asistió' :
                                                        item.status === 'ABSENT' ? 'Falta' :
                                                            item.status === 'LATE' ? 'Tardanza' : 'Justificado'}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ))}

                    {(!history || history.length === 0) && (
                        <div className="p-12 text-center text-gray-400 font-medium bg-gray-50/30 rounded-3xl">
                            No hay registros de asistencia disponibles.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
