"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, PlayCircle, StopCircle, RefreshCcw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { toggleSemesterStatusAction } from "@/server/actions/semester.actions";
import { useRouter } from "next/navigation";
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
            loading: activate ? 'Activando ciclo y cerrando anteriores...' : 'Cerrando ciclo...',
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
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestión de Ciclos Académicos</h1>
                    <p className="text-gray-500 mt-1">Configura y controla los periodos activos del sistema.</p>
                </div>
                <CreateCycleModal />
            </div>

            {/* Active Cycle Hero Card */}
            <div className="grid gap-6">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <PlayCircle className="w-5 h-5 text-meteorite-600" />
                    Ciclo Actualmente Activo
                </h2>

                {activeSemester ? (
                    <Card className="bg-gradient-to-br from-meteorite-900 to-meteorite-800 border-none text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none"></div>
                        <CardContent className="p-8 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                            <div>
                                <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-emerald-500/30">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                    En Curso
                                </div>
                                <h3 className="text-4xl font-extrabold mb-2">{activeSemester.name}</h3>
                                <div className="flex items-center gap-6 text-meteorite-200">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        <span>Inicio: {format(new Date(activeSemester.startDate), "d 'de' MMMM, yyyy", { locale: es })}</span>
                                    </div>
                                    {activeSemester.endDate && (
                                        <div className="flex items-center gap-2 border-l border-meteorite-600 pl-6">
                                            <Calendar className="w-4 h-4" />
                                            <span>Fin: {format(new Date(activeSemester.endDate), "d 'de' MMMM, yyyy", { locale: es })}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-200 border-red-500/30 border"
                                onClick={() => handleToggle(activeSemester.id, false)}
                                disabled={!!loadingId}
                            >
                                <StopCircle className="w-4 h-4 mr-2" />
                                Cerrar Ciclo Manualmente
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                            <StopCircle className="w-6 h-6 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-bold text-amber-800">No hay ningún ciclo activo</h3>
                        <p className="text-amber-600 max-w-md mt-2">
                            El sistema está en modo "Mantenimiento". No se pueden crear eventos ni registrar asistencias hasta que actives un ciclo.
                        </p>
                    </div>
                )}
            </div>

            {/* Inactive Cycles List */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <RefreshCcw className="w-5 h-5 text-gray-400" />
                    Historial de Ciclos
                </h2>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {semesters.filter(s => !s.isActive).length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            No hay ciclos inactivos en el historial.
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4">Nombre del Ciclo</th>
                                    <th className="px-6 py-4">Periodo</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {semesters.filter(s => !s.isActive).map((sem) => (
                                    <tr key={sem.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-900">{sem.name}</td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {format(new Date(sem.startDate), "MMM yyyy", { locale: es })}
                                            {" - "}
                                            {sem.endDate ? format(new Date(sem.endDate), "MMM yyyy", { locale: es }) : "..."}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                                <XCircle className="w-3 h-3" />
                                                Inactivo
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
                                                onClick={() => setConfirmActivateId(sem.id)}
                                                disabled={!!loadingId}
                                            >
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                Activar Ciclo
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Alert Dialog for Activation */}
            <AlertDialog open={!!confirmActivateId} onOpenChange={() => setConfirmActivateId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro de activar este ciclo?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción <strong>desactivará automáticamente</strong> cualquier otro ciclo que esté activo actualmente.
                            <br /><br />
                            El sistema pasará a operar bajo el periodo <strong>{semesters.find(s => s.id === confirmActivateId)?.name}</strong>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmActivateId && handleToggle(confirmActivateId, true)}
                            className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                        >
                            Confirmar Activación
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
