import { NextResponse } from "next/server";

import { getRequiredOwnerId } from "@/server/auth/owner";
import { saveOwnerUploadedMediaAsset } from "@/server/content/media-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(request: Request) {
  try {
    const ownerId = await getRequiredOwnerId();
    if (!sameOrigin(request)) return NextResponse.json({ error: "The upload origin was rejected." }, { status: 403 });
    const length = Number(request.headers.get("content-length") ?? 0);
    if (!Number.isFinite(length) || length <= 0 || length > 4.5 * 1024 * 1024) return NextResponse.json({ error: "Upload a PNG smaller than 4 MB." }, { status: 413 });
    const form = await request.formData();
    const file = form.get("file");
    const draftId = form.get("draftId");
    const altText = form.get("altText");
    const imageDescription = form.get("imageDescription");
    if (!(file instanceof File) || file.type !== "image/png" || typeof draftId !== "string" || !/^(draft|starter-draft)-[a-z0-9-]+$/.test(draftId) || typeof altText !== "string" || typeof imageDescription !== "string" || !altText.trim() || !imageDescription.trim()) {
      return NextResponse.json({ error: "Provide a valid PNG, description, and alt text." }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const asset = await saveOwnerUploadedMediaAsset({ altText: altText.trim().slice(0, 1000), bytes, draftId, imageDescription: imageDescription.trim().slice(0, 2000), ownerId });
    return NextResponse.json({ asset }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The private image could not be uploaded." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
