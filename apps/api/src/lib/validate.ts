import { z } from "zod";
import { errors } from "@investiq/shared";

/**
 * Validation — STEP 3 of the request pipeline. Parse body/query/params with a
 * Zod schema. Use `.strict()` schemas to REJECT unknown fields. Throws a safe
 * VALIDATION error (no internal details leaked).
 */
export function validate<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    throw errors.validation(`${where}${first?.message ?? "Invalid request"}`);
  }
  return result.data;
}
