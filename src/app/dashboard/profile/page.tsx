import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getMyProfileAction } from "@/server/actions/user.actions";
import UserProfileView from "@/components/profile/UserProfileView";

export default async function ProfilePage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const profileResult = await getMyProfileAction();

    if (!profileResult.success) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-red-500 font-medium">{profileResult.error}</p>
            </div>
        );
    }

    if (!profileResult.data) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-red-500 font-medium">No se pudo cargar el perfil</p>
            </div>
        );
    }

    return <UserProfileView userProfile={profileResult.data} />;
}
