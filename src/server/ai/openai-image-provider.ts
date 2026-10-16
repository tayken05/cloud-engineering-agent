import "server-only";

import OpenAI from "openai";

import { IMAGE_ASSET_MAX_BYTES, readPngDimensions, type AiImageProvider, type ImageInspection } from "@/features/content-studio/image-provider";
import { AiGenerationError, type AiRuntimeConfig } from "@/features/ai-content/types";
import { FORBIDDEN_TYPOGRAPHIC_DASH } from "@/features/ai-content/validation";
import type { AiImageRuntimeConfig } from "./image-config";

function inspection(value: unknown): Omit<ImageInspection, "inputTokens" | "outputTokens" | "responseId"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AiGenerationError("invalid_output", "Image inspection was invalid.");
  const item = value as Record<string, unknown>;
  const description = typeof item.description === "string" ? item.description.trim().slice(0, 2000) : "";
  const altText = typeof item.altText === "string" ? item.altText.trim().slice(0, 1000) : "";
  const fidelityWarnings = Array.isArray(item.fidelityWarnings) ? item.fidelityWarnings.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).slice(0, 8).map((entry) => entry.trim().slice(0, 300)) : [];
  if (!description || !altText || FORBIDDEN_TYPOGRAPHIC_DASH.test(`${description} ${altText} ${fidelityWarnings.join(" ")}`)) throw new AiGenerationError("invalid_output", "Image inspection was invalid.");
  return { altText, description, fidelityWarnings };
}

export function createOpenAiImageProvider(imageConfig: AiImageRuntimeConfig, textConfig: AiRuntimeConfig, apiKey: string): AiImageProvider {
  const client = new OpenAI({ apiKey, maxRetries: 1, timeout: imageConfig.requestTimeoutMs });
  return {
    id: "openai", model: imageConfig.model,
    async generate(request, signal) {
      try {
        const response = await client.images.generate({
          background: "opaque", model: imageConfig.model, n: 1, output_format: "png",
          prompt: request.prompt, quality: imageConfig.quality,
          size: request.aspect === "square" ? "1024x1024" : "1536x1024",
        }, { signal, timeout: imageConfig.requestTimeoutMs });
        const encoded = response.data?.[0]?.b64_json;
        if (!encoded) throw new AiGenerationError("provider_failure", "The image provider returned no image.");
        const bytes = Uint8Array.from(Buffer.from(encoded, "base64"));
        if (bytes.byteLength === 0 || bytes.byteLength > IMAGE_ASSET_MAX_BYTES) throw new AiGenerationError("invalid_output", "The generated image size is invalid.");
        return { bytes, contentType: "image/png" as const, ...readPngDimensions(bytes), inputTokens: response.usage?.input_tokens ?? 0, model: imageConfig.model, outputTokens: response.usage?.output_tokens ?? 0, providerRequestId: null };
      } catch (error) {
        if (error instanceof AiGenerationError) throw error;
        if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError) throw new AiGenerationError("provider_timeout", "Image generation timed out.");
        throw new AiGenerationError("provider_failure", "Image generation failed.");
      }
    },
    async inspect(image, subject, signal) {
      try {
        const response = await client.responses.create({
          input: [{ role: "user", content: [
            { type: "input_text", text: `Inspect this generated editorial image for the subject: ${subject}. Describe only what is visibly present. Identify labels or relationships that do not match the requested subject. Do not infer an incident or claim the scene is documentary evidence. Never use em or en dashes.` },
            { type: "input_image", detail: "high", image_url: `data:${image.contentType};base64,${Buffer.from(image.bytes).toString("base64")}` },
          ] }], max_output_tokens: 800, model: textConfig.model, store: false,
          text: { format: { name: "generated_image_inspection", strict: true, type: "json_schema", schema: {
            type: "object", additionalProperties: false, required: ["description", "altText", "fidelityWarnings"], properties: {
              description: { type: "string" }, altText: { type: "string" }, fidelityWarnings: { type: "array", maxItems: 8, items: { type: "string" } },
            },
          } } },
        }, { signal, timeout: imageConfig.requestTimeoutMs });
        if (!response.output_text) throw new AiGenerationError("provider_failure", "The generated image could not be inspected.");
        const checked = inspection(JSON.parse(response.output_text) as unknown);
        return { ...checked, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0, responseId: response.id || null };
      } catch (error) {
        if (error instanceof AiGenerationError) throw error;
        if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError) throw new AiGenerationError("provider_timeout", "Image inspection timed out.");
        throw new AiGenerationError("provider_failure", "The generated image could not be inspected.");
      }
    },
  };
}
