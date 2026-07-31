import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

/** BFF proxy so the client-side limit dropdowns can reach the Clerk-authed
 * API without shipping a token to the browser (apiFetch attaches it
 * server-side). Values are re-validated by the API — this is only transport. */
export async function PATCH(
  req: Request,
  { params }: { params: { bot: string } },
) {
  try {
    const body = await req.json();
    const data = await apiFetch(`/api/v1/quant-lab/controls/${encodeURIComponent(params.bot)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update bot control";
    return new NextResponse(message, { status: 400 });
  }
}
