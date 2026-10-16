import "server-only";

import type { AiPublicStatus } from "@/features/ai-content/types";
import { applyAiBudgetAvailability, getAiPublicStatus, readAiRuntimeConfig } from "./config";
import { getAiMonthlyCommittedMicrousd } from "./repository";

export async function getOwnerAiStatus(ownerId: string): Promise<AiPublicStatus> {
  const configured = getAiPublicStatus();
  if (!configured.available) return configured;

  try {
    const config = readAiRuntimeConfig();
    const committedMicrousd = await getAiMonthlyCommittedMicrousd(ownerId);
    return applyAiBudgetAvailability(configured, committedMicrousd, config.monthlyBudgetMicrousd);
  } catch {
    return { ...configured, available: false, reason: "status_unavailable" };
  }
}
