import { z } from "zod";

export type ActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };
