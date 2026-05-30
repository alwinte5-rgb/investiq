import type { FastifyInstance } from "fastify";
import { Webhook } from "svix";
import { deleteUserByClerkId, findOrProvisionUser } from "@investiq/db";
import { errors } from "@investiq/shared";

interface ClerkEmail {
  id: string;
  email_address: string;
}
interface ClerkUserData {
  id: string;
  email_addresses?: ClerkEmail[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
}
interface ClerkEvent {
  type: string;
  data: ClerkUserData;
}

function primaryEmail(data: ClerkUserData): string | null {
  const list = data.email_addresses ?? [];
  const primary = list.find((e) => e.id === data.primary_email_address_id);
  return (primary ?? list[0])?.email_address ?? null;
}

/**
 * Clerk webhook (PUBLIC route, signature-verified with svix). Keeps the User
 * mirror in sync. Encapsulated plugin so we can preserve the raw body needed
 * for signature verification without affecting JSON parsing elsewhere.
 */
export async function webhookRoutes(app: FastifyInstance, webhookSecret: string) {
  // Preserve raw body (as string) for this encapsulated scope only.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => done(null, body),
  );

  app.post("/webhooks/clerk", async (req, reply) => {
    const payload = req.body as string;
    const headers = req.headers;
    const wh = new Webhook(webhookSecret);

    let evt: ClerkEvent;
    try {
      evt = wh.verify(payload, {
        "svix-id": String(headers["svix-id"] ?? ""),
        "svix-timestamp": String(headers["svix-timestamp"] ?? ""),
        "svix-signature": String(headers["svix-signature"] ?? ""),
      }) as ClerkEvent;
    } catch {
      throw errors.unauthorized("Invalid webhook signature");
    }

    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const email = primaryEmail(evt.data);
        if (!email) throw errors.validation("Missing email");
        const name =
          [evt.data.first_name, evt.data.last_name].filter(Boolean).join(" ") || null;
        await findOrProvisionUser({
          clerkId: evt.data.id,
          email,
          name,
          avatarUrl: evt.data.image_url ?? null,
        });
        break;
      }
      case "user.deleted":
        await deleteUserByClerkId(evt.data.id);
        break;
      default:
        break; // ignore unrelated events
    }

    reply.code(200);
    return { data: { received: true } };
  });
}
