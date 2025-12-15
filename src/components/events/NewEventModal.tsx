"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import CreateEventForm from "./CreateEventForm";

interface NewEventModalProps {
    userRole: string;
    userAreaId: string | null;
    userAreaName: string | null;
    areas: any[];
}

export default function NewEventModal({ userRole, userAreaId, userAreaName, areas }: NewEventModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center px-5 py-2 bg-gradient-to-r from-meteorite-600 to-meteorite-700 text-white font-bold rounded-xl shadow-lg shadow-meteorite-600/30 hover:scale-105 active:scale-95 transition-all"
            >
                <Plus className="w-5 h-5 mr-2" />
                Nuevo Evento
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-meteorite-950/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsOpen(false)}
                    ></div>

                    {/* Modal Content */}
                    <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-float-up p-0">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100">
                            <h2 className="text-xl font-black text-meteorite-950">Programar Actividad</h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[85vh] overflow-y-auto">
                            <CreateEventForm
                                userRole={userRole}
                                userAreaId={userAreaId}
                                userAreaName={userAreaName}
                                areas={areas}
                                onSuccess={() => setIsOpen(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
