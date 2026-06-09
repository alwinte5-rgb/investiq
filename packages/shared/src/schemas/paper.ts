import { z } from "zod";
import { tickerSchema } from "./common.js";

/**
 * Body for POST /paper/orders — submit a simulated order. V1 is market-only
 * (fills at the live quote). `idempotencyKey` makes duplicate submits safe: the
 * same key returns the original order instead of placing a second one.
 */
export const paperOrderSchema = z
  .object({
    ticker: tickerSchema,
    side: z.enum(["BUY", "SELL"]),
    qty: z.coerce.number().positive().max(1_000_000),
    type: z.literal("market").default("market"),
    idempotencyKey: z.string().trim().min(8).max(100).optional(),
  })
  .strict();

export type PaperOrderInput = z.infer<typeof paperOrderSchema>;
