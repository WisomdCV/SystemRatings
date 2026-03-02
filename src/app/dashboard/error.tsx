"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Dashboard error:", error);
    }, [error]);

    return (
        <div className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Error en el dashboard
                    </h2>
                    <p className="text-gray-500 text-sm">
                        Ocurrió un error al cargar esta sección. Puedes intentar recargar o volver al inicio.
                    </p>
                    {error.digest && (
                        <p className="text-xs text-gray-400 mt-2 font-mono">
                            Ref: {error.digest}
                        </p>
                    )}
                </div>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-meteorite-600 text-white rounded-xl hover:bg-meteorite-700 transition-colors font-medium text-sm"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reintentar
                    </button>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm"
                    >
                        <Home className="w-4 h-4" />
                        Inicio
                    </Link>
                </div>
            </div>
        </div>
    );
}
