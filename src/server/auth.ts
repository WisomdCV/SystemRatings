import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { authConfig } from "../../auth.config";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { getCustomPermissionsForUser } from "@/server/data-access/custom-roles";


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
} = NextAuth(() => {
    // Build the adapter and override linkAccount to handle re-sign-in
    const baseAdapter = DrizzleAdapter(db, {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
    });

    const adapter = {
        ...baseAdapter,
        // Override linkAccount: on re-sign-in the (provider, providerAccountId) row
        // already exists → catch the UNIQUE constraint error and UPDATE instead.
        async linkAccount(account: any) {
            try {
                return await baseAdapter.linkAccount!(account);
            } catch (error: any) {
                const msg = String(error?.message ?? "");
                if (msg.includes("UNIQUE") || msg.includes("SQLITE_CONSTRAINT") || msg.includes("duplicate")) {
                    // Update existing account tokens instead of failing
                    await db
                        .update(accounts)
                        .set({
                            access_token: account.access_token,
                            refresh_token: account.refresh_token,
                            expires_at: account.expires_at,
                            token_type: account.token_type,
                            scope: account.scope,
                            id_token: account.id_token,
                            session_state: account.session_state,
                        })
                        .where(
                            and(
                                eq(accounts.provider, account.provider),
                                eq(accounts.providerAccountId, account.providerAccountId)
                            )
                        );
                    return account;
                }
                throw error;
            }
        },
    };

    return {
        ...authConfig,
        adapter,
        session: {
            strategy: "jwt" as const,
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
                columns: { status: true, suspendedUntil: true, role: true }
            });

            // Auto-DEV: If this is the very first user in the system, promote to DEV
            if (dbUser && (dbUser.role === "VOLUNTEER" || !dbUser.role)) {
                const [{ total }] = await db.select({ total: count() }).from(users);
                if (total <= 1) {
                    await db.update(users).set({ role: "DEV", status: "ACTIVE" }).where(eq(users.id, user.id!));
                    console.log(`🔑 Auto-DEV: First user ${user.email} promoted to DEV role`);
                } else if (dbUser.status === "ACTIVE") {
                    // New VOLUNTEER with ACTIVE status → gate them behind approval
                    await db.update(users).set({ status: "PENDING_APPROVAL" }).where(eq(users.id, user.id!));
                    console.log(`⏳ Approval gate: ${user.email} set to PENDING_APPROVAL`);
                }
            }

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
                // Fetch fresh data from DB (status may have been updated in signIn callback)
                const freshUser = await db.query.users.findFirst({
                    where: eq(users.id, user.id as string),
                    columns: { role: true, currentAreaId: true, status: true }
                });

                token.id = user.id;
                token.role = freshUser?.role ?? user.role;
                token.status = freshUser?.status ?? "ACTIVE";
                token.currentAreaId = freshUser?.currentAreaId ?? user.currentAreaId;

                // Save Provider tokens
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                // Google "expires_at" is seconds, we need ms for comparison
                token.expiresAt = (account.expires_at as number) * 1000;

                // Load custom role permissions
                if (user.id) {
                    try {
                        token.customPermissions = await getCustomPermissionsForUser(user.id);
                    } catch (e) {
                        console.error("Error loading custom permissions on sign in:", e);
                        token.customPermissions = [];
                    }
                }

                return token;
            }

            // 2. Client side update (e.g. update())
            if (trigger === "update" && session) {
                token = { ...token, ...session };
                // Force a DB refresh on explicit update
                token._lastDbRefresh = 0;
            }

            // 2.5 Periodic Refresh from DB (every 5 minutes instead of every request)
            // This reduces DB load from 2 queries/request to 2 queries/5min per user
            const DB_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
            const lastRefresh = (token._lastDbRefresh as number) || 0;
            const shouldRefreshDb = Date.now() - lastRefresh > DB_REFRESH_INTERVAL;

            if (token.id && shouldRefreshDb) {
                try {
                    const freshUser = await db.query.users.findFirst({
                        where: eq(users.id, token.id as string),
                        columns: { role: true, currentAreaId: true, status: true }
                    });

                    if (freshUser) {
                        token.role = freshUser.role;
                        token.currentAreaId = freshUser.currentAreaId;
                        token.status = freshUser.status;
                    }

                    // Refresh custom permissions
                    token.customPermissions = await getCustomPermissionsForUser(token.id as string);
                    token._lastDbRefresh = Date.now();
                } catch (error) {
                    console.error("Error refreshing user data in JWT:", error);
                }
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
                session.user.status = token.status as string | null;
                session.user.currentAreaId = token.currentAreaId as string | null;
                session.user.customPermissions = token.customPermissions as string[] | undefined;

                session.accessToken = token.accessToken as string | undefined;
                session.error = token.error as string | undefined;
            }
            return session;
        },
    },
    };
});
