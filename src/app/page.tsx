import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

export default async function Home() {
    const session = await auth();

    if (session?.user) {
        // Gate: PENDING_APPROVAL or VOLUNTEER without promotion → waiting page
        if (session.user.status === "PENDING_APPROVAL" || session.user.role === "VOLUNTEER") {
            redirect("/pending-approval");
        }
        redirect("/dashboard");
    }

    redirect("/login");
}
