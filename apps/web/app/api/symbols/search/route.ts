import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic"; // personalized auth — never cached

interface SymbolResult {
  ticker: string;
  name: string;
  assetType: "STOCK" | "ETF";
  exchange: string | null;
  sector: string | null;
}

/**
 * Thin BFF proxy so client components can do symbol typeahead. Attaches the
 * Clerk token server-side (in apiFetch) and forwards to the core API. No
 * business logic here — it only proxies.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ data: [] satisfies SymbolResult[] });

  try {
    const data = await apiFetch<SymbolResult[]>(
      `/api/v1/symbols/search?q=${encodeURIComponent(q)}`,
    );
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
