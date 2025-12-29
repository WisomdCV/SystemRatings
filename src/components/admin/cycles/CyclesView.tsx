"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, PlayCircle, StopCircle, RefreshCcw, CheckCircle2, XCircle, ArrowLeft, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { toggleSemesterStatusAction } from "@/server/actions/semester.actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CreateCycleModal from "./CreateCycleModal";

interface CyclesViewProps {
    semesters: any[];
}

export default function CyclesView({ semesters }: CyclesViewProps) {
    const router = useRouter();
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [confirmActivateId, setConfirmActivateId] = useState<string | null>(null);

    const activeSemester = semesters.find(s => s.isActive);

    const handleToggle = async (id: string, activate: boolean) => {
        setLoadingId(id);
        const promise = toggleSemesterStatusAction(id, activate);

        toast.promise(promise, {
            loading: activate ? 'Activando ciclo...' : 'Cerrando ciclo...',
            success: (data) => {
                setLoadingId(null);
                router.refresh();
                return data.message;
            },
            error: (err) => {
                setLoadingId(null);
                return err;
            }
        });
    };

    return (
        <div className="p-6 lg:p-10 min-h-screen bg-meteorite-50 relative overflow-hidden">
            {/* Background Orbs (Matched from EventsView) */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

            <div className="max-w-7xl mx-auto space-y-10 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-8 border-b border-meteorite-200/50">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="bg-white p-2.5 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100 shrink-0"
                            title="Volver al Dashboard"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black text-meteorite-950 tracking-tight">Gestión de Ciclos</h1>
                            <p className="text-meteorite-600 font-medium mt-1">Configura y controla los periodos académicos activos.</p>
                        </div>
                    </div>
                    <CreateCycleModal />
                </div>

                {/* Active Cycle Hero Card */}
                <div className="grid gap-6">
                    <h2 className="text-lg font-bold text-meteorite-900 flex items-center gap-2">
                        <PlayCircle className="w-5 h-5 text-meteorite-500" />
                        Ciclo Activo
                    </h2>

                    {activeSemester ? (
                        <Card className="bg-white border-0 shadow-2xl shadow-emerald-900/5 relative overflow-hidden rounded-3xl ring-1 ring-gray-100 group transition-all hover:shadow-emerald-900/10">
                            {/* Decorative Elements */}
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none transition-all group-hover:bg-emerald-100/50"></div>

                            <CardContent className="p-8 lg:p-10 flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                                <div className="flex-1">
                                    <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 border border-emerald-100 shadow-sm">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        En Curso
                                    </div>
                                    <h3 className="text-4xl lg:text-5xl font-black text-gray-900 mb-4 tracking-tight">{activeSemester.name}</h3>

                                    <div className="flex flex-wrap gap-6 text-gray-500 font-medium">
                                        <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                                            <Calendar className="w-4 h-4 text-meteorite-400" />
                                            <span className="text-sm">Inicio: <span className="text-gray-900 font-bold">{format(new Date(activeSemester.startDate), "d 'de' MMMM, yyyy", { locale: es })}</span></span>
                                        </div>
                                        {activeSemester.endDate && (
                                            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                                                <Calendar className="w-4 h-4 text-meteorite-400" />
                                                <span className="text-sm">Fin: <span className="text-gray-900 font-bold">{format(new Date(activeSemester.endDate), "d 'de' MMMM, yyyy", { locale: es })}</span></span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Button
                                    variant="destructive"
                                    className="h-auto py-3 px-6 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-100 shadow-sm font-bold transition-all"
                                    onClick={() => handleToggle(activeSemester.id, false)}
                                    disabled={!!loadingId}
                                >
                                    <StopCircle className="w-4 h-4 mr-2" />
                                    Finalizar Ciclo
                                </Button>

                                <Link href={`/admin/cycles/${activeSemester.id}/pillars`}>
                                    <Button variant="outline" className="h-auto py-3 px-6 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-meteorite-600 hover:text-white hover:border-meteorite-600 transition-all shadow-sm">
                                        <Layers className="w-4 h-4 mr-2" />
                                        Gestionar Pilares
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="bg-amber-50/50 border border-amber-100 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4 transform rotate-3 shadow-sm">
                                <StopCircle className="w-8 h-8 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Sistema en Pausa</h3>
                            <p className="text-gray-500 max-w-md mt-2">
                                Actualmente no hay un ciclo activo. Inicia uno nuevo para habilitar el registro de eventos y asistencia.
                            </p>
                        </div>
                    )}
                </div>

                {/* Inactive List */}
                <div className="space-y-6">
                    <h2 className="text-lg font-bold text-meteorite-900 flex items-center gap-2">
                        <RefreshCcw className="w-5 h-5 text-meteorite-500" />
                        Historial
                    </h2>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
                        {semesters.filter(s => !s.isActive).length === 0 ? (
                            <div className="p-12 text-center text-gray-400">
                                No hay ciclos anteriores registrados.
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50/80 text-gray-500 font-semibold border-b border-gray-100 uppercase text-xs tracking-wider">
                                    <tr>
                                        <th className="px-8 py-5">Ciclo</th>
                                        <th className="px-8 py-5">Duración</th>
                                        <th className="px-8 py-5">Estado</th>
                                        <th className="px-8 py-5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {semesters.filter(s => !s.isActive).map((sem) => (
                                        <tr key={sem.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-8 py-5">
                                                <span className="font-bold text-gray-900 text-lg">{sem.name}</span>
                                            </td>
                                            <td className="px-8 py-5 text-gray-500 font-medium">
                                                {format(new Date(sem.startDate), "MMM yyyy", { locale: es })}
                                                {" - "}
                                                {sem.endDate ? format(new Date(sem.endDate), "MMM yyyy", { locale: es }) : "..."}
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200 uppercase tracking-wide">
                                                    Inactivo
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="sm"
                                                    className="bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 font-bold rounded-lg shadow-sm"
                                                    onClick={() => setConfirmActivateId(sem.id)}
                                                    disabled={!!loadingId}
                                                >
                                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                                    Reactivar
                                                </Button>
                                                <Link href={`/admin/cycles/${sem.id}/pillars`}>
                                                    <Button size="sm" variant="ghost" className="text-gray-400 hover:text-meteorite-600">
                                                        <Layers className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Alert Dialog */}
                <AlertDialog open={!!confirmActivateId} onOpenChange={() => setConfirmActivateId(null)}>
                    <AlertDialogContent className="bg-white rounded-3xl border-0 shadow-2xl p-0 overflow-hidden max-w-md">
                        <div className="bg-emerald-50 p-6 flex flex-col items-center justify-center border-b border-emerald-100 text-center">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                <RefreshCcw className="w-6 h-6 text-emerald-600" />
                            </div>
                            <AlertDialogTitle className="text-xl font-black text-emerald-950">Reactivar Ciclo</AlertDialogTitle>
                        </div>

                        <div className="p-6 text-center">
                            <AlertDialogDescription className="text-gray-500">
                                Vas a reactivar el ciclo <strong>{semesters.find(s => s.id === confirmActivateId)?.name}</strong>.
                                <br />
                                Esto desactivará el ciclo actual automáticamente.
                            </AlertDialogDescription>
                        </div>

                        <AlertDialogFooter className="p-6 pt-0 sm:justify-center gap-3">
                            <AlertDialogCancel className="rounded-xl bg-white border-gray-200 text-gray-700 font-bold hover:bg-meteorite-600 hover:text-white hover:border-meteorite-600 mt-0 transition-all shadow-sm">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => confirmActivateId && handleToggle(confirmActivateId, true)}
                                className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl shadow-lg shadow-emerald-600/20 text-white"
                            >
                                Confirmar Cambio
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
