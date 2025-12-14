import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/auth/error', // Custom error page
  },
  callbacks: {
    // Forward extra fields from token to session/user so Middleware can see them
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role;
      }
      if (trigger === "update" && session) {
        token = { ...token, ...session };
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).role = token.role;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnAdmin = nextUrl.pathname.startsWith('/admin');

      // 1. Admin Routes Protection (Strict Rule)
      if (isOnAdmin) {
        if (!isLoggedIn) return false; // Redirect to login

        // Check for Role (Assuming role is populated in session)
        const role = (auth.user as any)?.role;
        if (role !== "DEV" && role !== "PRESIDENT") {
          // Redirect to Access Denied error page
          return Response.redirect(new URL('/auth/error?error=AccessDenied', nextUrl));
        }
        return true;
      }

      // 2. Dashboard Protection
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      } else if (isLoggedIn) {
        // Determine redirect based on role? For now just Dashboard
        // return Response.redirect(new URL('/dashboard', nextUrl));
      }

      return true;
    },
  },
  providers: [], // Se deja vacío aquí por compatibilidad con Edge
} satisfies NextAuthConfig;
