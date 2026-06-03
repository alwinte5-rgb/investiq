import type { FastifyInstance } from "fastify";
import { errors } from "@investiq/shared";

/**
 * JSON body parser that tolerates an EMPTY body. The web/mobile clients send
 * `Content-Type: application/json` on bodyless POSTs (connect a brokerage,
 * generate analysis/review, refresh news). Fastify's default parser throws on
 * the empty string, which our error handler then surfaces as a 500. Here an
 * empty body becomes `undefined` (handlers that require a body still reject it
 * via validation), and genuinely malformed JSON returns a clean 400.
 */
export function registerJsonBodyParser(app: FastifyInstance): void {
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    const text = typeof body === "string" ? body.trim() : "";
    if (text === "") {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(text));
    } catch {
      done(errors.validation("Invalid JSON body"), undefined);
    }
  });
}
