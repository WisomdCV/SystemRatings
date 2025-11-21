import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: '/login', // Tu página de login personalizada
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirige a login
      } else if (isLoggedIn) {
        // Si ya está logueado y está en login, mándalo al dashboard
        // return Response.redirect(new URL('/dashboard', nextUrl));
      }
      return true;
    },
  },
  providers: [], // Se deja vacío aquí por compatibilidad con Edge
} satisfies NextAuthConfig;
