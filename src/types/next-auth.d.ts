import 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extends the Session object to include our custom properties.
   */
  interface Session {
    user: {
      /** The user's unique identifier. */
      id: string;
      /** The user's role identifier. */
      role: number;
    } & DefaultSession['user']; // Keeps the default properties (name, email, image)
  }

  /**
   * Extends the default User object.
   */
  interface User {
    /** The user's role identifier. */
    role?: number;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extends the JWT to include our custom properties.
   */
  interface JWT {
    /** The user's unique identifier. */
    id?: string;
    /** The user's role identifier. */
    role?: number;
  }
}
