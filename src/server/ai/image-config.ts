import "server-only";

export type AiImageRuntimeConfig = Readonly<{
  enabled: boolean;
  maxEstimatedCostMicrousd: number;
  model: string;
  quality: "low" | "medium";
  requestTimeoutMs: number;
}>;

function flag(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  if (value.trim().toLowerCase() === "true") return true;
  if (value.trim().toLowerCase() === "false") return false;
  throw new Error("AI image configuration is invalid.");
}

function number(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = value?.trim() ? Number(value) : fallback;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error("AI image configuration is invalid.");
  return parsed;
}

export function readAiImageRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): AiImageRuntimeConfig {
  const model = (environment.AI_IMAGE_MODEL?.trim() || "gpt-image-2.5-flare").slice(0, 128);
  if (!/^gpt-image-[a-z0-9.-]+$/i.test(model)) throw new Error("AI image configuration is invalid.");
  const quality = environment.AI_IMAGE_QUALITY?.trim() || "low";
  if (quality !== "low" && quality !== "medium") throw new Error("AI image configuration is invalid.");
  return {
    enabled: flag(environment.AI_IMAGE_GENERATION_ENABLED),
    maxEstimatedCostMicrousd: Math.floor(number(environment.AI_IMAGE_MAX_COST_USD, 0.03, 0.001, 1) * 1_000_000),
    model,
    quality,
    requestTimeoutMs: Math.floor(number(environment.AI_IMAGE_REQUEST_TIMEOUT_MS, 120_000, 30_000, 180_000)),
  };
}

export type AiImagePublicStatus = Readonly<{
  available: boolean;
  maxEstimatedCostUsd: number;
  model: string;
  reason: "available" | "disabled" | "missing_storage" | "shared_ai_unavailable" | "invalid_configuration";
}>;

export function getAiImagePublicStatus(environment: NodeJS.ProcessEnv = process.env): AiImagePublicStatus {
  try {
    const config = readAiImageRuntimeConfig(environment);
    if (!config.enabled) return { available: false, maxEstimatedCostUsd: config.maxEstimatedCostMicrousd / 1_000_000, model: config.model, reason: "disabled" };
    if (!environment.BLOB_STORE_ID?.trim() && !environment.BLOB_READ_WRITE_TOKEN?.trim()) return { available: false, maxEstimatedCostUsd: config.maxEstimatedCostMicrousd / 1_000_000, model: config.model, reason: "missing_storage" };
    return { available: true, maxEstimatedCostUsd: config.maxEstimatedCostMicrousd / 1_000_000, model: config.model, reason: "available" };
  } catch {
    return { available: false, maxEstimatedCostUsd: 0, model: "gpt-image-2.5-flare", reason: "invalid_configuration" };
  }
}
