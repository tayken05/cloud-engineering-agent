import type { VisualAspect } from "./content-types.ts";

export type ImageGenerationRequest = Readonly<{
  aspect: VisualAspect;
  prompt: string;
  subject: string;
}>;

export type GeneratedImage = Readonly<{
  bytes: Uint8Array;
  contentType: "image/png";
  height: number;
  inputTokens: number;
  model: string;
  outputTokens: number;
  providerRequestId: string | null;
  width: number;
}>;

export type ImageInspection = Readonly<{
  altText: string;
  description: string;
  fidelityWarnings: readonly string[];
  inputTokens: number;
  outputTokens: number;
  responseId: string | null;
}>;

export interface AiImageProvider {
  readonly id: "openai";
  readonly model: string;
  generate(request: ImageGenerationRequest, signal: AbortSignal): Promise<GeneratedImage>;
  inspect(image: GeneratedImage, subject: string, signal: AbortSignal): Promise<ImageInspection>;
}

export const IMAGE_ASSET_MAX_BYTES = 15 * 1024 * 1024;

export function readPngDimensions(bytes: Uint8Array): Readonly<{ height: number; width: number }> {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) throw new Error("The image provider returned an invalid PNG.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width < 512 || height < 512 || width > 3840 || height > 3840) throw new Error("The image provider returned unsupported dimensions.");
  return { height, width };
}
