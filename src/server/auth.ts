import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { authConfig } from "../../auth.config";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";

export const {
    handlers: { GET, POST },
    auth,
    signIn,
    signOut,
} = NextAuth({
    ...authConfig,
    adapter: DrizzleAdapter(db, {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
    }),
    session: {
        strategy: "jwt",
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            },
            profile(profile) {
                return {
                    id: profile.sub,
                    name: profile.name,
                    firstName: profile.given_name,
                    lastName: profile.family_name,
                    email: profile.email,
                    image: profile.picture,
                    emailVerified: profile.email_verified,
                };
            },
            allowDangerousEmailAccountLinking: true,
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            if (!user.id) return false;

            // Check status directly from DB to ensure it's fresh
            const dbUser = await db.query.users.findFirst({
                where: eq(users.id, user.id),
                columns: { status: true, suspendedUntil: true }
            });

            if (!dbUser) return true; // Allow new users (they are created after this check usually, or we assume active)

            if (dbUser.status === "BANNED") return false;

            if (dbUser.status === "SUSPENDED") {
                if (dbUser.suspendedUntil && new Date() < dbUser.suspendedUntil) {
                    return false; // Still suspended
                }
            }

            return true;
        },
        async jwt({ token, user, account, trigger, session }) {
            // 1. On Initial Sign In: Merge user data into token
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.currentAreaId = user.currentAreaId;
            }

            // Capture Access Token and Refresh Token from Google Provider
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
            }

            // 2. On Update (e.g. client side update() call): Merge updates
            if (trigger === "update" && session) {
                token = { ...token, ...session };
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user && token) {
                session.user.id = token.id as string;
                session.user.role = token.role as string | null;
                session.user.currentAreaId = token.currentAreaId as string | null;

                // Pass access token to the client/session for API calls
                session.accessToken = token.accessToken as string | undefined;
            }
            return session;
        },
    },
});
