import { z } from "zod";

/** US equity/ETF ticker. Universe is constrained to US stocks & ETFs. */
export const tickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z.\-]{0,9}$/, "Invalid US ticker symbol");

export const cuidSchema = z.string().regex(/^c[a-z0-9]{20,}$/i, "Invalid id");

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Use `.strict()` on request schemas to REJECT unknown fields. */
export const symbolSearchSchema = z
  .object({ q: z.string().trim().min(1).max(50) })
  .strict();

export const createWatchlistSchema = z
  .object({ name: z.string().trim().min(1).max(60) })
  .strict();

export const addWatchlistItemSchema = z
  .object({ ticker: tickerSchema, note: z.string().max(280).optional() })
  .strict();
