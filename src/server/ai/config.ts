import "server-only";

import type { AiPublicStatus, AiRuntimeConfig } from "@/features/ai-content/types";

const DEFAULT_MODEL = "gpt-6-luna";
const DEFAULT_INPUT_COST = 0.05;
const DEFAULT_OUTPUT_COST = 0.25;

function boundedNumber(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error("AI generation configuration is invalid.");
  return parsed;
}

function booleanFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error("AI generation configuration is invalid.");
}

export function readAiRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): AiRuntimeConfig {
  const enabled = booleanFlag(environment.AI_GENERATION_ENABLED);
  const model = (environment.AI_TEXT_MODEL?.trim() || DEFAULT_MODEL).slice(0, 128);
  if (!/^[a-z0-9][a-z0-9._-]{1,127}$/i.test(model)) throw new Error("AI generation configuration is invalid.");
  const budgetUsd = boundedNumber(environment.AI_MONTHLY_BUDGET_USD, 0, 0, 10_000);
  return {
    enabled,
    inputCostPerMillionUsd: boundedNumber(environment.AI_INPUT_COST_PER_MILLION_USD, DEFAULT_INPUT_COST, 0, 10_000),
    maxRetries: Math.floor(boundedNumber(environment.AI_MAX_RETRIES, 1, 0, 2)),
    model,
    monthlyBudgetMicrousd: Math.floor(budgetUsd * 1_000_000),
    outputCostPerMillionUsd: boundedNumber(environment.AI_OUTPUT_COST_PER_MILLION_USD, DEFAULT_OUTPUT_COST, 0, 10_000),
    provider: "openai",
    requestTimeoutMs: Math.floor(boundedNumber(environment.AI_REQUEST_TIMEOUT_MS, 45_000, 5_000, 120_000)),
  };
}

export function readOpenAiApiKey(environment: NodeJS.ProcessEnv = process.env): string {
  const key = environment.OPENAI_API_KEY?.trim();
  if (!key || key.length < 20) throw new Error("AI generation configuration is invalid.");
  return key;
}

export function getAiPublicStatus(environment: NodeJS.ProcessEnv = process.env): AiPublicStatus {
  try {
    const config = readAiRuntimeConfig(environment);
    if (!config.enabled) return { available: false, budgetConfigured: config.monthlyBudgetMicrousd > 0, model: config.model, reason: "disabled" };
    if (config.monthlyBudgetMicrousd <= 0) return { available: false, budgetConfigured: false, model: config.model, reason: "zero_budget" };
    try { readOpenAiApiKey(environment); } catch { return { available: false, budgetConfigured: true, model: config.model, reason: "missing_key" }; }
    return { available: true, budgetConfigured: true, model: config.model, reason: "available" };
  } catch {
    return { available: false, budgetConfigured: false, model: DEFAULT_MODEL, reason: "invalid_configuration" };
  }
}

export function applyAiBudgetAvailability(
  status: AiPublicStatus,
  committedMicrousd: number,
  monthlyBudgetMicrousd: number,
): AiPublicStatus {
  if (!status.available) return status;
  if (!Number.isFinite(committedMicrousd) || committedMicrousd < 0) {
    return { ...status, available: false, reason: "status_unavailable" };
  }
  if (committedMicrousd >= monthlyBudgetMicrousd) {
    return { ...status, available: false, reason: "budget_exhausted" };
  }
  return status;
}
