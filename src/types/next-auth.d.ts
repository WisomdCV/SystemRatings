import 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extiende el objeto Session para incluir nuestras propiedades personalizadas.
   */
  interface Session {
    user: {
      id: string;
      role: number;
    } & DefaultSession['user']; // Mantiene las propiedades por defecto (name, email, image)
  }

  /**
   * Extiende el objeto User por defecto.
   */
  interface User {
    role?: number;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extiende el token JWT para incluir nuestras propiedades personalizadas.
   */
  interface JWT {
    id?: string;
    role?: number;
  }
}
