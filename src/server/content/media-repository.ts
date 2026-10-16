import "server-only";

import { del, get, put } from "@vercel/blob";
import { and, desc, eq } from "drizzle-orm";

import { IMAGE_ASSET_MAX_BYTES, readPngDimensions } from "@/features/content-studio/image-provider";
import type { ContentMediaAsset } from "@/features/content-studio/content-types";
import { contentDrafts, contentMediaAssets } from "@/server/db/schema";
import { withDatabaseTransaction } from "@/server/db/transaction";

const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

function view(row: typeof contentMediaAssets.$inferSelect): ContentMediaAsset {
  return { altText: row.altText, contentType: row.contentType as ContentMediaAsset["contentType"], createdAt: row.createdAt.toISOString(), draftId: row.draftId, height: row.height, id: row.id, imageDescription: row.imageDescription, origin: row.origin, provider: row.provider, width: row.width };
}

async function assertDraft(ownerId: string, draftId: string): Promise<void> {
  const rows = await withDatabaseTransaction((db) => db.select({ id: contentDrafts.id }).from(contentDrafts).where(and(eq(contentDrafts.id, draftId), eq(contentDrafts.ownerId, ownerId))).limit(1));
  if (!rows[0]) throw new Error("The draft is unavailable.");
}

export async function listContentMediaAssets(ownerId: string): Promise<readonly ContentMediaAsset[]> {
  const rows = await withDatabaseTransaction((db) => db.select().from(contentMediaAssets).where(eq(contentMediaAssets.ownerId, ownerId)).orderBy(desc(contentMediaAssets.createdAt)).limit(200));
  return rows.map(view);
}

export async function hasContentMediaAsset(ownerId: string, draftId: string): Promise<boolean> {
  const rows = await withDatabaseTransaction((db) => db.select({ id: contentMediaAssets.id }).from(contentMediaAssets)
    .where(and(eq(contentMediaAssets.ownerId, ownerId), eq(contentMediaAssets.draftId, draftId))).limit(1));
  return Boolean(rows[0]);
}

export async function getContentMediaAsset(ownerId: string, assetId: string) {
  const rows = await withDatabaseTransaction((db) => db.select().from(contentMediaAssets).where(and(eq(contentMediaAssets.id, assetId), eq(contentMediaAssets.ownerId, ownerId))).limit(1));
  return rows[0] ?? null;
}

export async function findContentMediaAssetByRun(ownerId: string, runId: string): Promise<ContentMediaAsset | null> {
  const rows = await withDatabaseTransaction((db) => db.select().from(contentMediaAssets).where(and(eq(contentMediaAssets.generationRunId, runId), eq(contentMediaAssets.ownerId, ownerId))).limit(1));
  return rows[0] ? view(rows[0]) : null;
}

export async function getContentMediaBlob(ownerId: string, assetId: string) {
  const asset = await getContentMediaAsset(ownerId, assetId);
  if (!asset) return null;
  const result = await get(asset.storagePathname, { access: "private", useCache: true });
  return result?.statusCode === 200 ? { asset, result } : null;
}

export async function saveGeneratedMediaAsset(input: Readonly<{
  altText: string;
  bytes: Uint8Array;
  draftId: string;
  generationPrompt: string;
  generationRunId: string;
  imageDescription: string;
  model: string;
  ownerId: string;
  provider: string;
  providerRequestId: string | null;
}>): Promise<ContentMediaAsset> {
  await assertDraft(input.ownerId, input.draftId);
  if (input.bytes.byteLength > IMAGE_ASSET_MAX_BYTES) throw new Error("The generated image is too large.");
  const dimensions = readPngDimensions(input.bytes);
  const id = crypto.randomUUID();
  const pathname = `private-content/${input.draftId}/${id}.png`;
  await put(pathname, Buffer.from(input.bytes), { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "image/png", maximumSizeInBytes: IMAGE_ASSET_MAX_BYTES });
  try {
    const rows = await withDatabaseTransaction((db) => db.insert(contentMediaAssets).values({
      altText: input.altText, byteSize: input.bytes.byteLength, contentType: "image/png", draftId: input.draftId,
      generationPrompt: input.generationPrompt, generationRunId: input.generationRunId, imageDescription: input.imageDescription,
      model: input.model, origin: "ai_generated", ownerId: input.ownerId, provider: input.provider,
      providerRequestId: input.providerRequestId, storagePathname: pathname, ...dimensions,
    }).returning());
    if (!rows[0]) throw new Error("The generated media record was not saved.");
    return view(rows[0]);
  } catch (error) {
    await del(pathname).catch(() => undefined);
    throw error;
  }
}

export async function saveOwnerUploadedMediaAsset(input: Readonly<{
  altText: string;
  bytes: Uint8Array;
  draftId: string;
  imageDescription: string;
  ownerId: string;
}>): Promise<ContentMediaAsset> {
  await assertDraft(input.ownerId, input.draftId);
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > UPLOAD_MAX_BYTES) throw new Error("The uploaded image must be a PNG smaller than 4 MB.");
  const dimensions = readPngDimensions(input.bytes);
  const id = crypto.randomUUID();
  const pathname = `private-content/${input.draftId}/${id}.png`;
  await put(pathname, Buffer.from(input.bytes), { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "image/png", maximumSizeInBytes: UPLOAD_MAX_BYTES });
  try {
    const rows = await withDatabaseTransaction((db) => db.insert(contentMediaAssets).values({
      altText: input.altText, byteSize: input.bytes.byteLength, contentType: "image/png", draftId: input.draftId,
      imageDescription: input.imageDescription, origin: "owner_upload", ownerId: input.ownerId, storagePathname: pathname, ...dimensions,
    }).returning());
    if (!rows[0]) throw new Error("The uploaded media record was not saved.");
    return view(rows[0]);
  } catch (error) {
    await del(pathname).catch(() => undefined);
    throw error;
  }
}
