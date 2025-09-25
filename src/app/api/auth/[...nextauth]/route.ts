import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

/**
 * Inicializa NextAuth con nuestra configuración y exporta los handlers.
 * Este archivo crea automáticamente los endpoints necesarios:
 * - /api/auth/signin
 * - /api/auth/signout
 * - /api/auth/session
 * - /api/auth/providers
 * - etc.
 */
const { handlers } = NextAuth(authConfig);

export const { GET, POST } = handlers;
