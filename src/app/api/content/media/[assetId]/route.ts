import { NextResponse } from "next/server";

import { getRequiredOwnerId } from "@/server/auth/owner";
import { getContentMediaBlob } from "@/server/content/media-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const ownerId = await getRequiredOwnerId();
    const assetId = (await context.params).assetId;
    if (!/^[0-9a-f-]{36}$/i.test(assetId)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const stored = await getContentMediaBlob(ownerId, assetId);
    if (!stored) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(stored.result.stream, { headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="content-${assetId}.png"`,
      "Content-Type": stored.asset.contentType,
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}
