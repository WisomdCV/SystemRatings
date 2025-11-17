import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

/**
 * Initializes NextAuth with the provided configuration and exports the handlers.
 * This file automatically creates the necessary API endpoints for authentication, such as:
 * - /api/auth/signin
 * - /api/auth/signout
 * - /api/auth/session
 * - /api/auth/providers
 *
 * @see https://next-auth.js.org/getting-started/route-handlers
 */
const { handlers } = NextAuth(authConfig);

/**
 * The HTTP GET and POST handlers for the NextAuth.js API route.
 * These handlers are responsible for processing authentication requests.
 *
 * @see https://next-auth.js.org/getting-started/route-handlers
 */
export const { GET, POST } = handlers;
