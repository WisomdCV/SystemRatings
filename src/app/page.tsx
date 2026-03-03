import { redirect } from "next/navigation";
import { authFresh } from "@/server/auth-fresh";

export default async function Home() {
    const session = await authFresh();

    if (session?.user) {
        // Gate: PENDING_APPROVAL or VOLUNTEER without promotion → waiting page
        if (session.user.status === "PENDING_APPROVAL" || session.user.role === "VOLUNTEER") {
            redirect("/pending-approval");
        }
        redirect("/dashboard");
    }

    redirect("/login");
}
