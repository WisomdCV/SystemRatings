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
        async jwt({ token, user, trigger, session }) {
            // 1. On Initial Sign In: Merge user data into token
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.currentAreaId = user.currentAreaId;
            }

            // 2. On Update (e.g. client side update() call): Merge updates
            if (trigger === "update" && session) {
                token = { ...token, ...session };
            }

            // 3. Optional: Refresh data from DB on every access (slower but fresher)
            // or just trust the token for performance. 
            // For now, let's keep it simple. If you promote a user, 
            // they might need to re-login or we implement a token refresh logic.

            return token;
        },
        async session({ session, token }) {
            if (session.user && token) {
                session.user.id = token.id as string;
                session.user.role = token.role as string | null;
                session.user.currentAreaId = token.currentAreaId as string | null;
            }
            return session;
        },
    },
});
