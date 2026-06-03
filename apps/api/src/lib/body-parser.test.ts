import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { AppError } from "@investiq/shared";
import { registerJsonBodyParser } from "./body-parser.js";

function buildApp() {
  const app = Fastify();
  registerJsonBodyParser(app);
  app.setErrorHandler((err, _req, reply) => {
    const status = err instanceof AppError ? err.httpStatus : 500;
    reply.code(status).send({ error: err.message });
  });
  app.post("/echo", async (req) => ({ data: req.body ?? null }));
  return app;
}

describe("registerJsonBodyParser", () => {
  it("treats an empty application/json body as undefined (no 500)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/json" },
      payload: "",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: null });
  });

  it("still parses a valid JSON body", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ a: 1 }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { a: 1 } });
  });

  it("rejects malformed JSON with a clean 400", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/json" },
      payload: "{bad",
    });
    expect(res.statusCode).toBe(400);
  });
});
