import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db"; // Tu cliente de Turso/SQLite
import { authConfig } from "@/auth.config"; // Importamos la config del paso 2

export const {
    handlers: { GET, POST },
    auth,
    signIn,
    signOut
} = NextAuth({
    ...authConfig, // Hereda la config de Edge
    adapter: DrizzleAdapter(db), // Conecta tu DB
    session: { strategy: "database" },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code",
                    // AQUÍ PIDES EL PERMISO PARA MEET
                    scope: "openid email profile https://www.googleapis.com/auth/meetings.space.created"
                },
            },
        }),
    ],
    callbacks: {
        async session({ session, user }) {
            // Aquí pasas el ID y el Rol a la sesión para usarlo en el frontend
            if (session.user) {
                session.user.id = user.id;
                // session.user.role = user.role; // Si extiendes el tipo
            }
            return session;
        }
    }
});
