import type { AiPublicStatus } from "./types";

export function aiStatusLabel(status: AiPublicStatus): string {
  if (status.available) return status.model;
  if (status.reason === "disabled") return "Disabled by configuration";
  if (status.reason === "zero_budget") return "No allowance";
  if (status.reason === "budget_exhausted") return "Allowance exhausted";
  if (status.reason === "missing_key") return "Credential missing";
  if (status.reason === "status_unavailable") return "Status unavailable";
  return "Configuration error";
}

export function aiStatusMessage(status: AiPublicStatus): string {
  if (status.reason === "disabled") return "AI generation is disabled by server configuration. Manual creation remains available.";
  if (status.reason === "zero_budget") return "AI generation has a zero monthly allowance and cannot make paid requests.";
  if (status.reason === "budget_exhausted") return "The configured monthly AI allowance has been used. Generation will remain unavailable until the allowance resets or is changed.";
  if (status.reason === "missing_key") return "AI generation is enabled, but its server-only provider credential is missing or invalid.";
  if (status.reason === "status_unavailable") return "The current monthly allowance could not be verified safely. No provider request can be made.";
  return "AI generation configuration is invalid. No provider request can be made.";
}
