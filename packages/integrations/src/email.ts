/**
 * Resend email delivery (Layer 4). The API secret is SERVER-ONLY. When no key
 * is configured the client reports `enabled: false` and refuses to send, so the
 * delivery layer degrades gracefully (in-app notifications still record).
 */
import { postJson, UpstreamError } from "./http.js";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailClient {
  readonly enabled: boolean;
  /** Send one email. Throws UpstreamError on failure; never call when disabled. */
  send(msg: EmailMessage): Promise<{ id: string | null }>;
}

const RESEND_URL = "https://api.resend.com/emails";

export function createResendClient(opts: { apiKey?: string; from: string }): EmailClient {
  const enabled = Boolean(opts.apiKey);
  return {
    enabled,
    async send(msg) {
      if (!enabled) {
        throw new UpstreamError("resend", "email delivery not configured (no RESEND_API_KEY)");
      }
      const res = await postJson<{ id?: string }>(
        "resend",
        RESEND_URL,
        { from: opts.from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text },
        { headers: { Authorization: `Bearer ${opts.apiKey}` } },
      );
      return { id: res.id ?? null };
    },
  };
}
