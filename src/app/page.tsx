import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

export default async function Home() {
    const session = await auth();

    if (session?.user) {
        if (session.user.status === "PENDING_APPROVAL") {
            redirect("/pending-approval");
        }
        redirect("/dashboard");
    }

    redirect("/login");
}
