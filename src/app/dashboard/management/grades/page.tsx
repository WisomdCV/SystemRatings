import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getGradingSheetAction } from "@/server/actions/grading-view.actions";
import GradingGrid from "@/components/grading/GradingGrid";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function GradingPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const role = session.user.role || "";
    if (!["PRESIDENT", "DIRECTOR", "SUBDIRECTOR", "DEV"].includes(role)) {
        redirect("/dashboard");
    }

    const { success, data, error } = await getGradingSheetAction();

    if (!success || !data) {
        return (
            <div className="p-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error || "Error desconocido al cargar planillas."}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-10 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-meteorite-950 tracking-tight">Gestión de Calificaciones</h1>
                <p className="text-gray-500 font-medium">
                    Ciclo Activo: <span className="text-meteorite-600 font-bold">{data.semester.name}</span>
                </p>
            </div>

            <GradingGrid
                initialData={data}
                currentUserRole={role}
            />
        </div>
    );
}
