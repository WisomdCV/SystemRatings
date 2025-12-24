import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getGradingSheetAction } from "@/server/actions/grading-view.actions";
import GradingGrid from "@/components/grading/GradingGrid";
import { AlertCircle, BookOpenCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function GradingPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const role = session.user.role || "";
    if (!["PRESIDENT", "DIRECTOR", "SUBDIRECTOR", "DEV"].includes(role)) {
        redirect("/dashboard");
    }

    const { success, data, error } = await getGradingSheetAction();

    // Error State
    if (!success || !data) {
        return (
            <div className="min-h-screen bg-meteorite-50 p-8 flex items-center justify-center">
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
                <Alert variant="destructive" className="max-w-md bg-white border-red-100 shadow-xl relative z-10">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error de Carga</AlertTitle>
                    <AlertDescription>{error || "No se pudo cargar la planilla de calificaciones."}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-10 min-h-screen bg-meteorite-50 relative overflow-hidden">
            {/* Background Orbs (Matched from EventsView) */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
            <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

            <div className="space-y-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-4 border-b border-meteorite-200/50">
                    <div>
                        <h1 className="text-3xl font-black text-meteorite-950 tracking-tight flex items-center gap-3">
                            <BookOpenCheck className="w-8 h-8 text-meteorite-600" />
                            Gestión de Calificaciones
                        </h1>
                        <p className="text-meteorite-600 font-medium mt-1 flex items-center gap-2">
                            Ciclo Activo:
                            <span className="bg-emerald-100 text-emerald-800 px-4 py-1.5 rounded-xl text-sm md:text-base font-black border border-emerald-200 uppercase tracking-wide shadow-sm transform hover:scale-105 transition-transform flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                {data.semester.name}
                            </span>
                        </p>
                    </div>
                </div>

                <GradingGrid
                    initialData={data}
                    currentUserRole={role}
                />
            </div>
        </div>
    );
}
