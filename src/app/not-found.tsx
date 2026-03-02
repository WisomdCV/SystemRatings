import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-meteorite-100 flex items-center justify-center">
                    <FileQuestion className="w-8 h-8 text-meteorite-600" />
                </div>
                <div>
                    <h2 className="text-4xl font-bold text-meteorite-950 mb-2">404</h2>
                    <p className="text-gray-500">
                        La página que buscas no existe o fue movida.
                    </p>
                </div>
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-meteorite-600 text-white rounded-xl hover:bg-meteorite-700 transition-colors font-medium"
                >
                    Volver al Dashboard
                </Link>
            </div>
        </div>
    );
}
