import { describe, it, expect, vi, afterEach } from "vitest";
import { createResendClient } from "./email.js";
import { createExpoPushClient } from "./push.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createResendClient", () => {
  it("is disabled and refuses to send without an API key", async () => {
    const client = createResendClient({ from: "noreply@investiq.app" });
    expect(client.enabled).toBe(false);
    await expect(client.send({ to: "a@b.com", subject: "x", html: "<p>x</p>" })).rejects.toThrow(
      /not configured/,
    );
  });

  it("posts to Resend with auth + from when configured", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
    );
    const client = createResendClient({ apiKey: "re_test", from: "noreply@investiq.app" });
    expect(client.enabled).toBe(true);

    const res = await client.send({ to: "user@example.com", subject: "Morning briefing", html: "<p>hi</p>" });
    expect(res.id).toBe("email_123");

    const init = fetchMock.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init?.body as string);
    expect(body.from).toBe("noreply@investiq.app");
    expect(body.to).toBe("user@example.com");
  });
});

describe("createExpoPushClient", () => {
  it("is disabled without an access token", async () => {
    const client = createExpoPushClient({});
    expect(client.enabled).toBe(false);
    await expect(client.send(["ExponentPushToken[x]"], { title: "t", body: "b" })).rejects.toThrow(
      /not configured/,
    );
  });

  it("filters non-Expo tokens and reports invalid ones for pruning", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }],
        }),
        { status: 200 },
      ),
    );
    const client = createExpoPushClient({ accessToken: "expo_test" });
    const res = await client.send(
      ["ExponentPushToken[good]", "ExponentPushToken[stale]", "not-a-token"],
      { title: "t", body: "b" },
    );
    expect(res.sent).toBe(1);
    expect(res.invalidTokens).toEqual(["ExponentPushToken[stale]"]);
  });

  it("returns early (no send) when there are no Expo tokens", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const client = createExpoPushClient({ accessToken: "expo_test" });
    const res = await client.send(["garbage"], { title: "t", body: "b" });
    expect(res).toEqual({ sent: 0, invalidTokens: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
