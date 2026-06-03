/**
 * Expo push delivery (Layer 4). Opt-in via EXPO_ACCESS_TOKEN — when absent the
 * client reports `enabled: false` and refuses to send. Tokens are device push
 * tokens stored in DeviceToken; expired/invalid tokens are reported back so the
 * caller can prune them.
 */
import { postJson, UpstreamError } from "./http.js";

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  /** Number of messages Expo accepted (status "ok"). */
  sent: number;
  /** Tokens Expo rejected as unregistered — safe to delete. */
  invalidTokens: string[];
}

export interface PushClient {
  readonly enabled: boolean;
  send(tokens: string[], msg: PushMessage): Promise<PushResult>;
}

const EXPO_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoTicket {
  status: "ok" | "error";
  details?: { error?: string };
}

export function createExpoPushClient(opts: { accessToken?: string }): PushClient {
  const enabled = Boolean(opts.accessToken);
  return {
    enabled,
    async send(tokens, msg) {
      if (!enabled) {
        throw new UpstreamError("expo", "push delivery not configured (no EXPO_ACCESS_TOKEN)");
      }
      const valid = tokens.filter((t) => t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken"));
      if (valid.length === 0) return { sent: 0, invalidTokens: [] };

      const messages = valid.map((to) => ({ to, title: msg.title, body: msg.body, data: msg.data }));
      const res = await postJson<{ data?: ExpoTicket[] }>("expo", EXPO_URL, messages, {
        headers: { Authorization: `Bearer ${opts.accessToken}`, Accept: "application/json" },
      });

      const tickets = res.data ?? [];
      let sent = 0;
      const invalidTokens: string[] = [];
      tickets.forEach((t, i) => {
        if (t.status === "ok") sent += 1;
        else if (t.details?.error === "DeviceNotRegistered") {
          const tok = valid[i];
          if (tok) invalidTokens.push(tok);
        }
      });
      return { sent, invalidTokens };
    },
  };
}
