import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { comparePasswords } from '@/lib/utils/password';

export const authConfig = {
  // Aquí puedes añadir más proveedores en el futuro (Google, GitHub, etc.)
  providers: [
    Credentials({
      // La función 'authorize' es el corazón de la autenticación por credenciales.
      // Se ejecuta cuando un usuario intenta iniciar sesión.
      async authorize(credentials) {
        // 1. Validar que tengamos email y contraseña
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const { email, password } = credentials;

        // 2. Buscar al usuario en la base de datos por su email
        const [user] = await db
          .select()
          .from(usuarios)
          .where(eq(usuarios.email, email as string));

        // Si no se encuentra el usuario, el login falla
        if (!user) {
          return null;
        }

        // 3. Comparar la contraseña proporcionada con el hash almacenado
        // Usamos nuestra nueva utilidad 'comparePasswords'
        const passwordsMatch = await comparePasswords(
          password as string,
          user.passwordHash
        );

        // Si las contraseñas coinciden, devolvemos el objeto de usuario
        if (passwordsMatch) {
          // El objeto que retornas aquí estará disponible en los callbacks (jwt, session)
          // Hacemos una pequeña transformación para que el id sea un string, como espera NextAuth
          return { ...user, id: user.id.toString() };
        }

        // Si las contraseñas no coinciden, el login falla
        return null;
      },
    }),
  ],
  // (Opcional) Puedes definir páginas personalizadas para login, error, etc.
  // pages: {
  //   signIn: '/login',
  // },
} satisfies NextAuthConfig;


