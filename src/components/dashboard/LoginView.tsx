"use client";

import { signIn } from "next-auth/react";
import { Zap } from "lucide-react";

export default function LoginView() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-meteorite-900 to-meteorite-950 p-4">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-10 left-10 w-72 h-72 bg-meteorite-600 rounded-full mix-blend-overlay filter blur-[100px] opacity-20 animate-pulse"></div>
                <div className="absolute bottom-10 right-10 w-96 h-96 bg-meteorite-400 rounded-full mix-blend-overlay filter blur-[100px] opacity-20"></div>
            </div>

            <div className="card-glass relative z-10 w-full max-w-md p-8 rounded-3xl text-center space-y-8 bg-white/95">
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-meteorite-500 to-meteorite-700 flex items-center justify-center shadow-lg shadow-meteorite-500/30 mb-6">
                        <Zap className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-meteorite-950">IISE Manager</h1>
                    <p className="text-meteorite-500">Sistema de Control y Rendimiento</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={() => signIn("google")}
                        className="w-full py-4 px-6 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-3 transition-all hover:shadow-md group"
                    >
                        <img
                            src="https://www.google.com/favicon.ico"
                            alt="Google"
                            className="w-5 h-5"
                        />
                        <span className="font-semibold text-gray-700 group-hover:text-gray-900">
                            Iniciar Sesión con Google
                        </span>
                    </button>
                </div>

                <p className="text-xs text-center text-gray-400 mt-8">
                    Acceso restringido a miembros autorizados de IISE.
                </p>
            </div>
        </div>
    );
}
