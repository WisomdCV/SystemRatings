import type { NextAuthConfig } from 'next-auth';

/**
 * Configuración de NextAuth.
 * Aquí definiremos los proveedores de autenticación, las páginas personalizadas,
 * y los callbacks para controlar el flujo de la sesión.
 */
export const authConfig = {
  // Por ahora, el array de proveedores está vacío.
  // En un paso posterior, añadiremos el proveedor de "Credenciales" para el login con email/contraseña.
  providers: [],
  pages: {
    // Aquí podríamos especificar rutas a páginas de login personalizadas si quisiéramos.
    // signIn: '/login',
  },
} satisfies NextAuthConfig;
