"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { createSemesterAction } from "@/server/actions/semester.actions";
import { useRouter } from "next/navigation";

export default function CreateCycleModal() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: "",
        startDate: "",
        endDate: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.name || !formData.startDate) {
                toast.error("Nombre y fecha de inicio son obligatorios");
                setLoading(false);
                return;
            }

            const res = await createSemesterAction({
                name: formData.name,
                startDate: new Date(formData.startDate),
                endDate: formData.endDate ? new Date(formData.endDate) : undefined
            });

            if (res.success) {
                toast.success(res.message);
                setOpen(false);
                setFormData({ name: "", startDate: "", endDate: "" });
                router.refresh();
            } else {
                toast.error(res.error);
            }
        } catch (error) {
            toast.error("Error inesperado al crear ciclo");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center px-5 py-2 bg-gradient-to-r from-meteorite-600 to-meteorite-700 text-white font-bold rounded-xl shadow-lg shadow-meteorite-600/30 hover:scale-105 active:scale-95 transition-all"
            >
                <Plus className="w-5 h-5 mr-2" />
                Nuevo Ciclo
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-meteorite-950/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setOpen(false)}
                    ></div>

                    {/* Modal Content */}
                    <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-float-up p-0">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100">
                            <h2 className="text-xl font-black text-meteorite-950">Crear Nuevo Ciclo</h2>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                            >
                                <Plus className="w-5 h-5 rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-gray-700 font-bold">Nombre del Ciclo</Label>
                                <Input
                                    id="name"
                                    placeholder="Ej. 2025-2"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    required
                                    className="bg-white text-gray-900 rounded-xl border-gray-200 focus:border-meteorite-500 focus:ring-meteorite-500/20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="startDate" className="text-gray-700 font-bold">Inicio</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                                        required
                                        className="bg-white text-gray-900 rounded-xl border-gray-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endDate" className="text-gray-700 font-bold">Fin (Opcional)</Label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                                        className="bg-white text-gray-900 rounded-xl border-gray-200"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setOpen(false)}
                                    className="rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-700 font-bold"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="rounded-xl bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold shadow-lg shadow-meteorite-600/20"
                                >
                                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                    Crear Ciclo
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
