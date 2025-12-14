import { auth } from "@/server/auth";
import LoginView from "@/components/dashboard/LoginView";
import DashboardView from "@/components/dashboard/DashboardView";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return <LoginView />;
  }

  return <DashboardView user={session.user} />;
}
