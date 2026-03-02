"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Unhandled error:", error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Algo salió mal
                    </h2>
                    <p className="text-gray-500 text-sm">
                        Ocurrió un error inesperado. Puedes intentar recargar la página.
                    </p>
                    {error.digest && (
                        <p className="text-xs text-gray-400 mt-2 font-mono">
                            Ref: {error.digest}
                        </p>
                    )}
                </div>
                <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-meteorite-600 text-white rounded-xl hover:bg-meteorite-700 transition-colors font-medium"
                >
                    <RotateCcw className="w-4 h-4" />
                    Intentar de nuevo
                </button>
            </div>
        </div>
    );
}
