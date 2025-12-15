import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { authConfig } from "../../auth.config";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";


// Helper to refresh Google Access Token
async function refreshAccessToken(token: any) {
    try {
        const url = "https://oauth2.googleapis.com/token";
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
            }),
        });

        const refreshedTokens = await response.json();

        if (!response.ok) {
            throw refreshedTokens;
        }

        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            expiresAt: Date.now() + refreshedTokens.expires_in * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
        };
    } catch (error) {
        console.error("Error refreshing access token", error);
        return {
            ...token,
            error: "RefreshAccessTokenError",
        };
    }
}

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
        maxAge: 7 * 24 * 60 * 60, // 7 days
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

            const dbUser = await db.query.users.findFirst({
                where: eq(users.id, user.id),
                columns: { status: true, suspendedUntil: true }
            });

            if (!dbUser) return true;

            if (dbUser.status === "BANNED") return false;

            if (dbUser.status === "SUSPENDED") {
                if (dbUser.suspendedUntil && new Date() < dbUser.suspendedUntil) {
                    return false;
                }
            }

            return true;
        },
        async jwt({ token, user, account, trigger, session }) {
            // 1. Initial Sign In
            if (account && user) {
                // Save DB fields
                token.id = user.id;
                token.role = user.role;
                token.currentAreaId = user.currentAreaId;

                // Save Provider tokens
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                // Google "expires_at" is seconds, we need ms for comparison
                token.expiresAt = (account.expires_at as number) * 1000;

                return token;
            }

            // 2. Client side update (e.g. update())
            if (trigger === "update" && session) {
                token = { ...token, ...session };
            }

            // 3. Return previous token if the access token has not expired yet
            // Give a 10 second buffer
            if (Date.now() < (token.expiresAt as number) - 10000) {
                return token;
            }

            // 4. Access token has expired, try to update it
            return refreshAccessToken(token);
        },
        async session({ session, token }) {
            if (session.user && token) {
                session.user.id = token.id as string;
                session.user.role = token.role as string | null;
                session.user.currentAreaId = token.currentAreaId as string | null;

                session.accessToken = token.accessToken as string | undefined;
                session.error = token.error as string | undefined; // Pass error to client if needed
            }
            return session;
        },
    },
});
