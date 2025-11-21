chEste es un proyecto full-stack construido con Next.js y TypeScript, utilizando el App Router para el enrutamiento.

**Arquitectura y Composición:**

*   **Framework Principal:** Next.js (React).
*   **Lenguaje:** TypeScript.
*   **Base de Datos:** SQLite, administrada con el ORM Drizzle. La configuración se encuentra en `drizzle.config.ts` y el esquema de la base de datos (las tablas y sus columnas) debería estar definido en `src/lib/db/schema.ts`.
*   **Autenticación:** NextAuth.js se encarga de la autenticación. La configuración principal parece estar en `src/auth.config.ts` y las rutas de la API para el registro y el inicio de sesión están en `src/app/api/auth/`.
*   **Estilos:** Tailwind CSS.
*   **Estructura del Proyecto:**
    *   `app/`: Contiene las páginas y rutas públicas de la aplicación, siguiendo la convención del App Router de Next.js.
    *   `src/`: Alberga la lógica principal de la aplicación, incluyendo la configuración de la base de datos, la lógica de autenticación y tipos personalizados.
    *   `public/`: Almacena archivos estáticos como imágenes y SVGs.
    *   `package.json`: Define las dependencias y scripts del proyecto.

En resumen, es una aplicación web monolítica moderna que sigue las mejores prácticas actuales para el desarrollo con Next.js. La lógica está separada de la presentación, y utiliza herramientas populares para la base de datos y la autenticación.

---

### Modelo Entidad-Relación (E-R)

El modelo Entidad-Relación (E-R) del proyecto, basado en el archivo `src/lib/db/schema.ts`, es el siguiente:

### Entidades (Tablas) y sus Atributos:

1.  **`categorias`**
    *   `id`: INTEGER (Clave Primaria)
    *   `nombre`: TEXT (No nulo, Único)
    *   `descripcion`: TEXT

2.  **`roles`**
    *   `id`: INTEGER (Clave Primaria)
    *   `nombre`: TEXT (No nulo, Único)

3.  **`cargos`**
    *   `id`: INTEGER (Clave Primaria)
    *   `nombre`: TEXT (No nulo, Único)
    *   `descripcion`: TEXT

4.  **`usuarios`**
    *   `id`: INTEGER (Clave Primaria)
    *   `nombre`: TEXT (No nulo)
    *   `email`: TEXT (No nulo, Único)
    *   `passwordHash`: TEXT (No nulo)
    *   `codigo`: TEXT (Único)
    *   `año`: INTEGER
    *   `telefono`: TEXT
    *   `fotoUrl`: TEXT
    *   `categoriaId`: INTEGER (Clave Foránea a `categorias.id`)
    *   `rolId`: INTEGER (No nulo, Clave Foránea a `roles.id`, valor por defecto 3)
    *   `fechaCreacion`: TEXT (No nulo, por defecto `CURRENT_TIMESTAMP`)
    *   `fechaActualizacion`: TEXT (No nulo, por defecto `CURRENT_TIMESTAMP`)

5.  **`usuarioCargos`** (Tabla Pivote)
    *   `usuarioId`: INTEGER (No nulo, Clave Foránea a `usuarios.id`)
    *   `cargoId`: INTEGER (No nulo, Clave Foránea a `cargos.id`)
    *   **Clave Primaria Compuesta:** (`usuarioId`, `cargoId`)

### Relaciones:

*   **`usuarios` a `categorias`**:
    *   Tipo: Muchos a Uno (`usuarios` a `categorias`)
    *   `usuarios.categoriaId` hace referencia a `categorias.id`.
    *   Comportamiento `onDelete`: `SET NULL` (si una categoría es eliminada, los usuarios asociados tendrán su `categoriaId` establecido en `NULL`).

*   **`usuarios` a `roles`**:
    *   Tipo: Muchos a Uno (`usuarios` a `roles`)
    *   `usuarios.rolId` hace referencia a `roles.id`.
    *   Comportamiento `onDelete`: `RESTRICT` (no se puede eliminar un rol si hay usuarios asociados a él).

*   **`usuarios` a `cargos`**:
    *   Tipo: Muchos a Muchos, a través de la tabla pivote `usuarioCargos`.
    *   `usuarioCargos.usuarioId` hace referencia a `usuarios.id`.
    *   `usuarioCargos.cargoId` hace referencia a `cargos.id`.
    *   Comportamiento `onDelete` para ambas claves foráneas en `usuarioCargos`: `CASCADE` (si un usuario o un cargo es eliminado, las entradas correspondientes en `usuarioCargos` también se eliminan).

### Resumen Visual (Conceptual):

```
+-----------------+       +-----------------+       +-----------------+
|    categorias   |       |      roles      |       |      cargos     |
+-----------------+       +-----------------+       +-----------------+
| PK id           |<------| PK id           |<------| PK id           |
| nombre          |       | nombre          |       | nombre          |
| descripcion     |       +-----------------+       | descripcion     |
+-----------------+                                 +-----------------+
        ^                                                   ^
        | (1:M)                                             | (M:M)
        |                                                   |
+---------------------------------------------------------------------+
|                           usuarios                                  |
+---------------------------------------------------------------------+
| PK id                                                               |
| nombre                                                              |
| email (UNIQUE)                                                      |
| passwordHash                                                        |
| codigo (UNIQUE)                                                     |
| año                                                                 |
| telefono                                                            |
| fotoUrl                                                             |
| FK categoriaId (ON DELETE SET NULL)                                 |
| FK rolId (NOT NULL, DEFAULT 3, ON DELETE RESTRICT)                  |
| fechaCreacion                                                       |
| fechaActualizacion                                                  |
+---------------------------------------------------------------------+
        |
        | (M:M)
        v
+---------------------------------+
|          usuarioCargos          |
+---------------------------------+
| PK,FK usuarioId (ON DELETE CASCADE) |
| PK,FK cargoId (ON DELETE CASCADE)   |
+---------------------------------+
```