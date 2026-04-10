import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { authFresh } from "@/server/auth-fresh";
import { hasPermission } from "@/lib/permissions";
import AccessPreviewView from "@/components/admin/access-preview/AccessPreviewView";
import { getAccessPreviewBootstrapAction } from "@/server/actions/access-preview.actions";

export default async function AccessPreviewPage() {
  const session = await authFresh();
  if (!session?.user) redirect("/login");

  const role = session.user.role || "";
  const canAccess =
    hasPermission(role, "admin:audit", session.user.customPermissions)
    || hasPermission(role, "admin:roles", session.user.customPermissions);

  if (!canAccess) {
    redirect("/dashboard?error=AccessDenied");
  }

  const bootstrapResult = await getAccessPreviewBootstrapAction();

  if (!bootstrapResult.success) {
    return (
      <div className="min-h-screen bg-meteorite-50 flex items-center justify-center p-10">
        <div className="text-center text-red-500 bg-white rounded-2xl shadow p-8">
          <h3 className="font-bold text-lg">Error al cargar vista previa</h3>
          <p>{bootstrapResult.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-meteorite-50 relative overflow-hidden p-4 md:p-6 2xl:p-10">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
      <div className="absolute top-20 -left-20 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animation-delay-2000"></div>

      <div className="relative z-10 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="bg-white p-2.5 rounded-full text-meteorite-600 hover:text-meteorite-800 hover:bg-meteorite-100 transition-all shadow-sm border border-meteorite-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 flex items-center justify-center shadow-lg shadow-indigo-900/20">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-meteorite-950">Vista Previa de Accesos</h2>
              <p className="text-meteorite-500 text-sm font-medium">Simula qué puede ver y ejecutar un usuario o rol en Events y Projects.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 font-semibold">
          Modo simulación: esta vista NO ejecuta mutaciones reales ni cambia datos. Solo evalúa reglas de visibilidad y permisos.
        </div>

        <AccessPreviewView bootstrap={bootstrapResult.data} />
      </div>
    </div>
  );
}
