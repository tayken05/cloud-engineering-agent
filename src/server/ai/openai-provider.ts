import "server-only";

import OpenAI from "openai";

import { AiGenerationError, type AiRuntimeConfig, type AiTextProvider } from "@/features/ai-content/types";

export function createOpenAiProvider(config: AiRuntimeConfig, apiKey: string): AiTextProvider {
  const client = new OpenAI({ apiKey, maxRetries: config.maxRetries, timeout: config.requestTimeoutMs });
  return {
    id: "openai",
    model: config.model,
    async generateStructured(request) {
      try {
        const response = await client.responses.create({
          input: request.input,
          instructions: request.instructions,
          max_output_tokens: request.maxOutputTokens,
          model: config.model,
          store: false,
          text: {
            format: {
              name: request.schemaName,
              schema: request.schema,
              strict: true,
              type: "json_schema",
            },
            verbosity: "medium",
          },
        }, { maxRetries: config.maxRetries, signal: request.signal, timeout: config.requestTimeoutMs });
        if (response.error || response.incomplete_details || !response.output_text) throw new AiGenerationError("provider_failure", "The AI provider did not complete the structured response.");
        let data: unknown;
        try { data = JSON.parse(response.output_text) as unknown; } catch { throw new AiGenerationError("invalid_output", "The AI provider returned invalid JSON."); }
        return {
          data,
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
          responseId: response.id || null,
        };
      } catch (error) {
        if (error instanceof AiGenerationError) throw error;
        if (request.signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError) throw new AiGenerationError("provider_timeout", "The AI provider request timed out.");
        throw new AiGenerationError("provider_failure", "The AI provider request failed.");
      }
    },
  };
}
