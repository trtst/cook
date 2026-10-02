import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";

export const IMAGE_GENERATION_PROVIDERS = Symbol("IMAGE_GENERATION_PROVIDERS");

export type ImageGenerationAspectRatio = "1:1" | "4:3" | "16:9";
export type ImageGenerationProviderId = "ARK_SEEDREAM" | "VOLCENGINE_CV";

export interface ImageGenerationProvider {
  generate(prompt: string, options: { aspectRatio: ImageGenerationAspectRatio }): Promise<{ imageUrl: string }>;
}

export type ImageGenerationProviderMap = Readonly<Record<ImageGenerationProviderId, ImageGenerationProvider>>;

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

const visualImageSizes: Record<ImageGenerationAspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1328, height: 1328 },
  "4:3": { width: 1472, height: 1104 },
  "16:9": { width: 1664, height: 936 }
};

type VolcengineVisualImageResponse = {
  status?: number;
  message?: string;
  data?: {
    algorithm_base_resp?: { status_code?: number; status_message?: string };
    image_urls?: string[];
  };
};

@Injectable()
export class VolcengineVisualImageGenerationProvider implements ImageGenerationProvider {
  async generate(prompt: string, options: { aspectRatio: ImageGenerationAspectRatio }) {
    const apiKey = process.env.VOLCENGINE_CV_API_KEY?.trim();
    if (!apiKey) throw new ServiceUnavailableException("请在 API 服务配置 VOLCENGINE_CV_API_KEY");
    const { width, height } = visualImageSizes[options.aspectRatio];
    let response: Response;
    try {
      response = await fetch("https://openapi.cv.volces.com/api/common/v3/process", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          req_key: "high_aes_general_v30l_zt2i",
          prompt,
          width,
          height,
          return_url: true,
          logo_info: { add_logo: true, position: 0, language: 0, opacity: 1 }
        }),
        signal: AbortSignal.timeout(120_000)
      });
    } catch {
      throw new ServiceUnavailableException("连接火山视觉智能生图接口失败");
    }
    const body = await response.json().catch(() => ({})) as VolcengineVisualImageResponse;
    if (!response.ok || body.status !== 10000 || body.data?.algorithm_base_resp?.status_code !== 0) {
      throw new BadRequestException(body.data?.algorithm_base_resp?.status_message ?? body.message ?? `火山视觉智能生图失败（${response.status}）`);
    }
    const imageUrl = body.data.image_urls?.[0];
    if (!imageUrl) throw new BadRequestException("火山视觉智能响应未包含图片 URL");
    return { imageUrl };
  }
}
