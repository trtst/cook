import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";

export const IMAGE_GENERATION_PROVIDER = Symbol("IMAGE_GENERATION_PROVIDER");

export type ImageGenerationAspectRatio = "1:1" | "4:3" | "16:9";

export interface ImageGenerationProvider {
  generate(prompt: string, options: { aspectRatio: ImageGenerationAspectRatio }): Promise<{ imageUrl: string }>;
}

const imageSizes = {
  "1K": { "1:1": "1024x1024", "4:3": "1152x864", "16:9": "1424x800" },
  "1.5K": { "1:1": "1536x1536", "4:3": "1792x1344", "16:9": "2048x1152" },
  "2K": { "1:1": "2048x2048", "4:3": "2368x1776", "16:9": "2816x1584" }
} as const;

@Injectable()
export class ArkImageGenerationProvider implements ImageGenerationProvider {
  async generate(prompt: string, options: { aspectRatio: ImageGenerationAspectRatio }) {
    const apiKey = process.env.ARK_API_KEY?.trim();
    const model = process.env.ARK_IMAGE_MODEL?.trim();
    if (!apiKey || !model) throw new ServiceUnavailableException("请在 API 服务配置 ARK_API_KEY 和 ARK_IMAGE_MODEL");
    const endpoint = process.env.ARK_IMAGE_ENDPOINT?.trim() || "https://ark.cn-beijing.volces.com/api/v3/images/generations";
    const resolution = process.env.ARK_IMAGE_RESOLUTION?.trim() || "1K";
    if (!Object.prototype.hasOwnProperty.call(imageSizes, resolution)) throw new ServiceUnavailableException("ARK_IMAGE_RESOLUTION 仅支持 1K、1.5K 或 2K");
    const outputFormat = process.env.ARK_IMAGE_OUTPUT_FORMAT?.trim().toLowerCase() || "jpeg";
    if (outputFormat !== "jpeg" && outputFormat !== "png") throw new ServiceUnavailableException("ARK_IMAGE_OUTPUT_FORMAT 仅支持 jpeg 或 png");
    const watermarkValue = process.env.ARK_IMAGE_WATERMARK?.trim().toLowerCase();
    if (watermarkValue && watermarkValue !== "true" && watermarkValue !== "false") throw new ServiceUnavailableException("ARK_IMAGE_WATERMARK 仅支持 true 或 false");
    const watermark = watermarkValue ? watermarkValue === "true" : true;
    const size = imageSizes[resolution as keyof typeof imageSizes][options.aspectRatio];
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, size, output_format: outputFormat, response_format: "url", stream: false, watermark }),
        signal: AbortSignal.timeout(120_000)
      });
    } catch {
      throw new ServiceUnavailableException("连接火山方舟生图接口失败");
    }
    const body = await response.json().catch(() => ({})) as { data?: Array<{ url?: string }> ; error?: { message?: string } };
    if (!response.ok) throw new BadRequestException(body.error?.message ?? `火山方舟生图失败（${response.status}）`);
    const imageUrl = body.data?.[0]?.url;
    if (!imageUrl) throw new BadRequestException("火山方舟响应未包含图片 URL");
    return { imageUrl };
  }
}
