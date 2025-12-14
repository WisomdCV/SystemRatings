import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import LoginView from "@/components/dashboard/LoginView";

export default async function LoginPage() {
    const session = await auth();

    if (session?.user) {
        redirect("/dashboard");
    }

    return <LoginView />;
}
