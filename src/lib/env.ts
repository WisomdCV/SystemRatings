import { z } from "zod";

/**
 * Runtime validation for required environment variables.
 * This runs at startup to fail fast with clear error messages
 * instead of crashing with cryptic errors at random points.
 */
const envSchema = z.object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    LIBSQL_AUTH_TOKEN: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
    GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
    AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
});

function validateEnv() {
    // In build time, env vars may not be available (Vercel injects them at runtime)
    // Skip validation during build
    if (process.env.NEXT_PHASE === "phase-production-build") {
        return process.env as unknown as z.infer<typeof envSchema>;
    }

    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const formatted = result.error.issues
            .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
            .join("\n");

        throw new Error(
            `\n❌ Missing or invalid environment variables:\n${formatted}\n\n` +
            `Please check your .env file or Vercel environment configuration.\n`
        );
    }

    return result.data;
}

export const env = validateEnv();
