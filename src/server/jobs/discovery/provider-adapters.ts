import {
  JOB_BOARD_MAX_BYTES,
  JOB_BOARD_MAX_RECORDS,
  JOB_BOARD_TIMEOUT_MS,
} from "./employer-registry.ts";
import type { BoardFailure, EmployerBoard, ProviderJob } from "./types.ts";

type JsonRecord = Record<string, unknown>;

export class ProviderAdapterError extends Error {
  readonly reason: BoardFailure["reason"];

  constructor(reason: BoardFailure["reason"]) {
    super("The recruiting provider response was not accepted.");
    this.name = "ProviderAdapterError";
    this.reason = reason;
  }
}

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function date(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function htmlToText(value: unknown): string {
  const raw = string(value) ?? "";
  return raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8_000);
}

function validatedHttps(value: unknown, hosts: readonly string[]): string | null {
  const raw = string(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.hash || !hosts.includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function apiUrl(board: EmployerBoard): Readonly<{ hosts: readonly string[]; url: string }> {
  if (board.provider === "greenhouse") {
    // Greenhouse serves both US and EU-hosted public boards through this API host.
    const host = "boards-api.greenhouse.io";
    return { hosts: [host], url: `https://${host}/v1/boards/${encodeURIComponent(board.externalSourceId)}/jobs?content=true` };
  }
  if (board.provider === "ashby") {
    return { hosts: ["api.ashbyhq.com"], url: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board.externalSourceId)}` };
  }
  const department = board.providerScope?.department;
  const query = department ? `?mode=json&department=${encodeURIComponent(department)}` : "?mode=json";
  return { hosts: ["api.lever.co", "api.eu.lever.co"], url: `https://api.lever.co/v0/postings/${encodeURIComponent(board.externalSourceId)}${query}` };
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > JOB_BOARD_MAX_BYTES) throw new ProviderAdapterError("response_too_large");
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderAdapterError("invalid_response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > JOB_BOARD_MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new ProviderAdapterError("response_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ProviderAdapterError("invalid_response"); }
}

function parseGreenhouse(payload: unknown, hosts: readonly string[]): readonly ProviderJob[] {
  const jobs = record(payload)?.jobs;
  if (!Array.isArray(jobs) || jobs.length > JOB_BOARD_MAX_RECORDS) throw new ProviderAdapterError("invalid_response");
  return jobs.map((raw): ProviderJob => {
    const item = record(raw);
    const location = record(item?.location);
    const id = item && (typeof item.id === "number" || typeof item.id === "string") ? String(item.id) : null;
    const title = string(item?.title);
    const url = validatedHttps(item?.absolute_url, ["job-boards.greenhouse.io", "job-boards.eu.greenhouse.io", ...hosts]);
    if (!id || !title || !url) throw new ProviderAdapterError("invalid_response");
    return Object.freeze({
      applicationUrl: url, description: htmlToText(item?.content), employmentType: null, externalId: id,
      location: string(location?.name) ?? "Location not specified", providerUpdatedAt: date(item?.updated_at),
      publishedAt: null, sourceListingUrl: url, title, workplaceType: null,
    });
  });
}

function parseAshby(payload: unknown): readonly ProviderJob[] {
  const jobs = record(payload)?.jobs;
  if (!Array.isArray(jobs) || jobs.length > JOB_BOARD_MAX_RECORDS) throw new ProviderAdapterError("invalid_response");
  return jobs.flatMap((raw): readonly ProviderJob[] => {
    const item = record(raw);
    if (item?.isListed === false) return [];
    const id = string(item?.id);
    const title = string(item?.title);
    const jobUrl = validatedHttps(item?.jobUrl, ["jobs.ashbyhq.com"]);
    const applyUrl = validatedHttps(item?.applyUrl, ["jobs.ashbyhq.com"]) ?? jobUrl;
    if (!id || !title || !jobUrl || !applyUrl) throw new ProviderAdapterError("invalid_response");
    return [Object.freeze({
      applicationUrl: applyUrl, description: htmlToText(item?.descriptionPlain ?? item?.descriptionHtml),
      employmentType: string(item?.employmentType), externalId: id, location: string(item?.location) ?? "Location not specified",
      providerUpdatedAt: null, publishedAt: date(item?.publishedAt), sourceListingUrl: jobUrl, title,
      workplaceType: string(item?.workplaceType),
    })];
  });
}

function parseLever(payload: unknown): readonly ProviderJob[] {
  if (!Array.isArray(payload) || payload.length > JOB_BOARD_MAX_RECORDS) throw new ProviderAdapterError("invalid_response");
  return payload.map((raw): ProviderJob => {
    const item = record(raw);
    const categories = record(item?.categories);
    const id = string(item?.id);
    const title = string(item?.text);
    const listing = validatedHttps(item?.hostedUrl, ["jobs.lever.co", "jobs.eu.lever.co"]);
    const apply = validatedHttps(item?.applyUrl, ["jobs.lever.co", "jobs.eu.lever.co"]) ?? listing;
    if (!id || !title || !listing || !apply) throw new ProviderAdapterError("invalid_response");
    const lists = Array.isArray(item?.lists) ? item.lists.map(record).filter((value): value is JsonRecord => Boolean(value)) : [];
    const listText = lists.map((value) => `${string(value.text) ?? ""} ${htmlToText(value.content)}`).join(" ");
    return Object.freeze({
      applicationUrl: apply, description: `${htmlToText(item?.descriptionPlain ?? item?.description)} ${listText}`.trim().slice(0, 8_000),
      employmentType: string(categories?.commitment), externalId: id, location: string(categories?.location) ?? "Location not specified",
      providerUpdatedAt: null, publishedAt: null, sourceListingUrl: listing, title,
      workplaceType: string(item?.workplaceType),
    });
  });
}

export async function fetchEmployerBoard(
  board: EmployerBoard,
  options: Readonly<{ fetcher?: typeof fetch; signal?: AbortSignal }> = {},
): Promise<readonly ProviderJob[]> {
  const endpoint = apiUrl(board);
  const fetcher = options.fetcher ?? fetch;
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(JOB_BOARD_TIMEOUT_MS)])
    : AbortSignal.timeout(JOB_BOARD_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetcher(endpoint.url, {
      headers: { accept: "application/json", "user-agent": "CloudEngineeringAgent/1.0 (+https://cloud-engineering-agent.vercel.app)" },
      redirect: "error", signal,
    });
  } catch {
    if (signal.aborted) throw new ProviderAdapterError("aborted");
    throw new ProviderAdapterError("network");
  }
  if (!response.ok) throw new ProviderAdapterError("http");
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json")) throw new ProviderAdapterError("invalid_response");
  let payload: unknown;
  try {
    payload = await readBoundedJson(response);
  } catch (error) {
    if (error instanceof ProviderAdapterError) throw error;
    if (signal.aborted) throw new ProviderAdapterError("aborted");
    throw new ProviderAdapterError("network");
  }
  if (board.provider === "greenhouse") return parseGreenhouse(payload, endpoint.hosts);
  if (board.provider === "ashby") return parseAshby(payload);
  const scoped = [...parseLever(payload)];
  const present = new Set(scoped.map((job) => job.externalId));
  for (const postingId of board.verifiedPostingIds ?? []) {
    if (present.has(postingId)) continue;
    let postingResponse: Response;
    try {
      postingResponse = await fetcher(`https://api.lever.co/v0/postings/${encodeURIComponent(board.externalSourceId)}/${encodeURIComponent(postingId)}`, {
        headers: { accept: "application/json", "user-agent": "CloudEngineeringAgent/1.0 (+https://cloud-engineering-agent.vercel.app)" },
        redirect: "error", signal,
      });
    } catch {
      if (signal.aborted) throw new ProviderAdapterError("aborted");
      throw new ProviderAdapterError("network");
    }
    // A missing tracked posting is omitted so two complete successful checks can
    // establish closure. Other failures make the whole scoped board inconclusive.
    if (postingResponse.status === 404 || postingResponse.status === 410) continue;
    if (!postingResponse.ok || !postingResponse.headers.get("content-type")?.toLowerCase().includes("json")) {
      throw new ProviderAdapterError("http");
    }
    const postingPayload = await readBoundedJson(postingResponse);
    scoped.push(...parseLever([postingPayload]));
  }
  return scoped;
}
