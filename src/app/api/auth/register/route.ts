import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/utils/password';

/**
 * Maneja las peticiones POST para registrar un nuevo usuario.
 * @param {Request} req - El objeto de la petición.
 * @returns {NextResponse} - La respuesta de la API.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, email, password } = body;

    // 1. Validación de los datos de entrada
    if (!nombre || !email || !password) {
      return NextResponse.json(
        { message: 'Nombre, email y contraseña son requeridos.' },
        { status: 400 }
      );
    }

    // 2. Verificar si el usuario ya existe en la base de datos
    const usuarioExistente = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, email));

    if (usuarioExistente.length > 0) {
      return NextResponse.json(
        { message: 'El correo electrónico ya está en uso.' },
        { status: 409 } // 409 Conflict
      );
    }

    // 3. Hashear la contraseña antes de guardarla
    const hashedPassword = await hashPassword(password);

    // 4. Insertar el nuevo usuario en la base de datos
    // Usamos .returning() para que nos devuelva los datos del usuario creado
    const nuevoUsuario = await db
      .insert(usuarios)
      .values({
        nombre,
        email,
        passwordHash: hashedPassword, // <-- CORRECCIÓN AQUÍ
        // rol_id se establece por defecto a 3 (Usuario) según el esquema
      })
      .returning({
        id: usuarios.id,
        nombre: usuarios.nombre,
        email: usuarios.email,
      });

    // 5. Devolver una respuesta exitosa
    return NextResponse.json(
      {
        usuario: nuevoUsuario[0],
        message: 'Usuario registrado exitosamente.',
      },
      { status: 201 } // 201 Created
    );
  } catch (error) {
    console.error('Error en el registro:', error);
    return NextResponse.json(
      { message: 'Ocurrió un error en el servidor.' },
      { status: 500 }
    );
  }
}


