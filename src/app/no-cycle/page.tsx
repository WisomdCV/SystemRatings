import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function NoCyclePage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-meteorite-50 to-meteorite-100 p-4">
            <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md text-center border border-meteorite-100">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-amber-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Ciclo no activado aún
                </h1>
                <p className="text-gray-600 mb-6">
                    El sistema está en espera de que un administrador active
                    el ciclo académico actual. Por favor, contacta al Presidente
                    o un administrador del sistema.
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-meteorite-600 hover:text-meteorite-800 font-medium transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio
                </Link>
            </div>
        </div>
    );
}
