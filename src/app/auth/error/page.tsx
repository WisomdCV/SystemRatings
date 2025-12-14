"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ShieldAlert, ArrowLeft } from "lucide-react";
import { Suspense } from "react";

function ErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");

    let title = "Autenticación Fallida";
    let message = "Ocurrió un error al intentar iniciar sesión.";

    if (error === "AccessDenied") {
        title = "Acceso Denegado";
        message = "Tu cuenta ha sido suspendida o no tienes permisos para acceder a esta área. Si crees que es un error, contacta a la administración.";
    } else if (error === "Verification") {
        title = "Enlace Inválido";
        message = "El enlace de verificación ha expirado o ya ha sido utilizado.";
    }

    return (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-red-50 p-6 flex flex-col items-center border-b border-red-100">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-red-700">{title}</h1>
            </div>

            <div className="p-8 text-center">
                <p className="text-gray-600 mb-6 leading-relaxed">
                    {message}
                </p>

                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-8 text-sm text-orange-800 flex items-start text-left">
                    <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 text-orange-500" />
                    <p>
                        Código de error: <span className="font-mono font-bold">{error || "Unknown"}</span>
                    </p>
                </div>

                <Link
                    href="/"
                    className="inline-flex items-center justify-center w-full px-6 py-3 text-white font-medium bg-meteorite-600 hover:bg-meteorite-700 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver al Inicio
                </Link>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-meteorite-50 p-4">
            <Suspense fallback={<div>Cargando...</div>}>
                <ErrorContent />
            </Suspense>
        </div>
    );
}
