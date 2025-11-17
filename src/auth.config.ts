import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { comparePasswords } from '@/lib/utils/password';

/**
 * Configuration for NextAuth.js.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  // You can add more providers here in the future (e.g., Google, GitHub).
  providers: [
    Credentials({
      /**
       * The `authorize` function is the core of credentials-based authentication.
       * It is executed when a user attempts to sign in.
       *
       * @param {Partial<Record<string, unknown>>} credentials - The user's credentials (e.g., email and password).
       * @returns {Promise<any | null>} - The user object if authentication is successful, otherwise null.
       */
      async authorize(credentials) {
        // 1. Validate that we have an email and password.
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const { email, password } = credentials;

        // 2. Find the user in the database by their email.
        const [user] = await db
          .select()
          .from(usuarios)
          .where(eq(usuarios.email, email as string));

        // If the user is not found, authentication fails.
        if (!user) {
          return null;
        }

        // 3. Compare the provided password with the stored hash.
        // We use our 'comparePasswords' utility for this.
        const passwordsMatch = await comparePasswords(
          password as string,
          user.passwordHash
        );

        // If the passwords match, return the user object.
        if (passwordsMatch) {
          // The object you return here will be available in the callbacks (jwt, session).
          // We perform a small transformation to make the id a string, as NextAuth expects.
          return { ...user, id: user.id.toString() };
        }

        // If the passwords do not match, authentication fails.
        return null;
      },
    }),
  ],
  // (Optional) You can define custom pages for sign-in, error, etc.
  // pages: {
  //   signIn: '/login',
  // },
} satisfies NextAuthConfig;
