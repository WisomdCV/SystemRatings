"use client";

import { useState, useTransition } from "react";
import { toggleSemesterStatusAction } from "@/server/actions/semester.actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, CheckCircle, Loader2 } from "lucide-react";

interface Semester {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date | null;
    isActive: boolean;
}

interface Props {
    semesters: Semester[];
}

export default function SemesterSelector({ semesters }: Props) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleActivate = () => {
        if (!selectedId) {
            toast.error("Selecciona un ciclo primero");
            return;
        }

        startTransition(async () => {
            const result = await toggleSemesterStatusAction(selectedId, true);

            if (result.success) {
                toast.success("¡Ciclo activado correctamente!");
                router.push("/dashboard");
            } else {
                toast.error(result.error || "Error al activar el ciclo");
            }
        });
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                {semesters.map((semester) => (
                    <button
                        key={semester.id}
                        onClick={() => setSelectedId(semester.id)}
                        disabled={isPending}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedId === semester.id
                            ? "border-meteorite-500 bg-meteorite-50"
                            : "border-gray-200 hover:border-meteorite-200 hover:bg-gray-50"
                            } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedId === semester.id
                                    ? "bg-meteorite-500 text-white"
                                    : "bg-gray-100 text-gray-600"
                                    }`}>
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{semester.name}</p>
                                    <p className="text-sm text-gray-500">
                                        {formatDate(semester.startDate)}
                                        {semester.endDate && ` — ${formatDate(semester.endDate)}`}
                                    </p>
                                </div>
                            </div>
                            {selectedId === semester.id && (
                                <CheckCircle className="w-5 h-5 text-meteorite-500" />
                            )}
                        </div>
                    </button>
                ))}
            </div>

            <button
                onClick={handleActivate}
                disabled={!selectedId || isPending}
                className="w-full py-3 px-6 bg-gradient-to-r from-meteorite-600 to-meteorite-700 text-white font-bold rounded-xl 
                    hover:from-meteorite-700 hover:to-meteorite-800 transition-all shadow-lg shadow-meteorite-200
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                    flex items-center justify-center gap-2"
            >
                {isPending ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Activando...
                    </>
                ) : (
                    <>
                        <CheckCircle className="w-5 h-5" />
                        Activar Ciclo Seleccionado
                    </>
                )}
            </button>
        </div>
    );
}
