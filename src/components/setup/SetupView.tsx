"use client";

import { useState } from "react";
import CreateSemesterForm from "./CreateSemesterForm";
import SemesterSelector from "./SemesterSelector";
import { Sparkles, Calendar, Plus } from "lucide-react";

interface Semester {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date | null;
    isActive: boolean;
}

interface Props {
    semesters: Semester[];
    isFirstTime: boolean;
    userName: string;
}

export default function SetupView({ semesters, isFirstTime, userName }: Props) {
    const [showCreate, setShowCreate] = useState(semesters.length === 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-meteorite-50 via-white to-meteorite-100 py-12 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-meteorite-500 to-meteorite-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-meteorite-200">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900">
                        {isFirstTime ? "¡Bienvenido al Sistema!" : "Configuración de Ciclo"}
                    </h1>
                    <p className="text-gray-600 mt-2 max-w-md mx-auto">
                        {isFirstTime
                            ? `Hola ${userName}, eres el primero en configurar el sistema. Crea el primer ciclo académico para comenzar.`
                            : "Selecciona un ciclo existente para activar o crea uno nuevo."}
                    </p>
                </div>

                {/* Content */}
                <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                    {/* Tabs cuando hay semestres */}
                    {semesters.length > 0 && (
                        <div className="flex border-b border-gray-100">
                            <button
                                onClick={() => setShowCreate(false)}
                                className={`flex-1 py-4 px-6 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${!showCreate
                                    ? "bg-meteorite-50 text-meteorite-700 border-b-2 border-meteorite-500"
                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                    }`}
                            >
                                <Calendar className="w-4 h-4" />
                                Seleccionar Ciclo
                            </button>
                            <button
                                onClick={() => setShowCreate(true)}
                                className={`flex-1 py-4 px-6 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${showCreate
                                    ? "bg-meteorite-50 text-meteorite-700 border-b-2 border-meteorite-500"
                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                    }`}
                            >
                                <Plus className="w-4 h-4" />
                                Crear Nuevo
                            </button>
                        </div>
                    )}

                    <div className="p-6 md:p-8">
                        {!showCreate && semesters.length > 0 ? (
                            <SemesterSelector semesters={semesters} />
                        ) : (
                            <CreateSemesterForm isFirstTime={isFirstTime} />
                        )}
                    </div>
                </div>

                {/* Nota informativa */}
                <p className="text-center text-sm text-gray-500 mt-6">
                    Solo puede haber un ciclo activo a la vez. Al activar un nuevo ciclo,
                    el anterior se desactivará automáticamente.
                </p>
            </div>
        </div>
    );
}
