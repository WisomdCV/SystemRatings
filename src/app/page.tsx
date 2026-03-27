import { redirect } from "next/navigation";
import { authFresh } from "@/server/auth-fresh";

export default async function Home() {
    const session = await authFresh();

    if (session?.user) {
        if (session.user.status === "BANNED") {
            redirect("/auth/error?error=RequestRejected");
        }

        if (session.user.status === "SUSPENDED") {
            redirect("/auth/error?error=AccessDenied");
        }

        // Gate: users still awaiting admission.
        if (session.user.status === "PENDING_APPROVAL" || (session.user.role === "VOLUNTEER" && session.user.status === "ACTIVE")) {
            redirect("/pending-approval");
        }
        redirect("/dashboard");
    }

    redirect("/login");
}
