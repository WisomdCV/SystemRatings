"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-meteorite-600 hover:bg-meteorite-700 text-white font-bold gap-2">
                    <Plus className="w-4 h-4" />
                    Nuevo Ciclo
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Ciclo Académico</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre del Ciclo (ej. 2025-2)</Label>
                        <Input
                            id="name"
                            placeholder="2025-2"
                            value={formData.name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Inicio</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={formData.startDate}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">Fin (Opcional)</Label>
                            <Input
                                id="endDate"
                                type="date"
                                value={formData.endDate}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-meteorite-600 hover:bg-meteorite-700">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Crear Ciclo
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
