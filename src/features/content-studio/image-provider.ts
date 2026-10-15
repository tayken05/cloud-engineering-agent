import type { VisualAspect } from "./content-types.ts";

export type ImageGenerationMode = "generate" | "edit";

export type ImageGenerationRequest = Readonly<{
  aspect: VisualAspect;
  caption: string;
  mode: ImageGenerationMode;
  prompt: string;
  referenceAssetIds: readonly string[];
}>;

export type GeneratedImageAsset = Readonly<{
  assetId: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  height: number;
  provider: string;
  providerRequestId: string | null;
  width: number;
}>;

/**
 * Future providers must return durable asset metadata after the operator-approved
 * result has been copied to configured object storage. Temporary provider URLs
 * and base64 payloads must never be stored in PostgreSQL as the asset itself.
 */
export interface ImageGenerationProvider {
  readonly id: string;
  readonly supportsEditing: boolean;
  generate(request: ImageGenerationRequest, options: Readonly<{ signal: AbortSignal }>): Promise<GeneratedImageAsset>;
}

export const PLANNED_IMAGE_PROVIDERS = Object.freeze([
  {
    configured: false,
    id: "openai-images",
    label: "OpenAI Images",
    note: "Planned for text-to-image and conversational or direct editing after credentials, budgets, approval, and durable storage are configured.",
  },
  {
    configured: false,
    id: "xai-grok-imagine",
    label: "xAI Grok Imagine",
    note: "Planned for generation and editing after credentials, budgets, approval, temporary-output capture, and durable storage are configured.",
  },
] as const);
