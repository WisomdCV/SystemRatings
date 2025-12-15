import 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extiende el objeto Session para incluir nuestras propiedades personalizadas.
   */
  interface Session {
    accessToken?: string;
    error?: string; // Add error property
    user: {
      id: string;
      role: string | null;
      currentAreaId: string | null;
    } & DefaultSession['user'];
  }

  /**
   * Extiende el objeto User por defecto.
   */
  interface User {
    role?: string | null;
    currentAreaId?: string | null;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extiende el token JWT para incluir nuestras propiedades personalizadas.
   */
  interface JWT {
    id?: string;
    role?: string | null;
    currentAreaId?: string | null;
    accessToken?: string;
    refreshToken?: string;
  }
}
