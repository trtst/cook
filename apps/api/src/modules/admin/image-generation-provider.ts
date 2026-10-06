import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Pool, type PoolClient } from "pg";

export const IMAGE_GENERATION_PROVIDERS = Symbol("IMAGE_GENERATION_PROVIDERS");

export type ImageGenerationAspectRatio = "1:1" | "3:4" | "16:9" | "ORIGINAL";
export type ImageGenerationProviderId = "ARK_SEEDREAM" | "VOLCENGINE_CV";

export interface ImageGenerationProvider {
  generate(prompt: string, options: { aspectRatio: ImageGenerationAspectRatio }): Promise<{ imageUrl: string }>;
}

export type ImageGenerationProviderMap = Readonly<Record<ImageGenerationProviderId, ImageGenerationProvider>>;

const imageSizes = {
  "1K": { "1:1": "1024x1024", "3:4": "864x1152", "16:9": "1424x800" },
  "1.5K": { "1:1": "1536x1536", "3:4": "1344x1792", "16:9": "2048x1152" },
  "2K": { "1:1": "2048x2048", "3:4": "1776x2368", "16:9": "2816x1584" }
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
    const size = options.aspectRatio === "ORIGINAL" ? undefined : imageSizes[resolution as keyof typeof imageSizes][options.aspectRatio];
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, ...(size ? { size } : {}), output_format: outputFormat, response_format: "url", stream: false, watermark }),
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

const visualImageSizes: Record<Exclude<ImageGenerationAspectRatio, "ORIGINAL">, { width: number; height: number }> = {
  "1:1": { width: 1328, height: 1328 },
  "3:4": { width: 1104, height: 1472 },
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
  private requestQueue: Promise<void> = Promise.resolve();
  private lockPool: Pool | null = null;

  async generate(prompt: string, options: { aspectRatio: ImageGenerationAspectRatio }) {
    const apiKey = process.env.VOLCENGINE_CV_API_KEY?.trim();
    if (!apiKey) throw new ServiceUnavailableException("请在 API 服务配置 VOLCENGINE_CV_API_KEY");
    const dimensions = options.aspectRatio === "ORIGINAL" ? {} : visualImageSizes[options.aspectRatio];
    return this.runSerially(() => this.runWithGlobalLock(async () => {
      let response: Response;
      try {
        response = await fetch("https://openapi.cv.volces.com/api/common/v3/process", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            req_key: "high_aes_general_v30l_zt2i",
            prompt,
            ...dimensions,
            return_url: true,
            logo_info: { add_logo: true, position: 0, language: 0, opacity: 1, logo_text_content: "炊火记" }
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
    }));
  }

  async onModuleDestroy() {
    await this.lockPool?.end();
    this.lockPool = null;
  }

  private async runWithGlobalLock<T>(request: () => Promise<T>): Promise<T> {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) throw new ServiceUnavailableException("视觉智能生图限流需要配置 API 服务 DATABASE_URL");

    this.lockPool ??= new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000 });
    let client: PoolClient;
    try {
      client = await this.lockPool.connect();
    } catch {
      throw new ServiceUnavailableException("无法连接数据库获取视觉智能生图限流锁");
    }

    const lockName = "admin-volcengine-visual-image-generation";
    const deadline = Date.now() + 10 * 60_000;
    let locked = false;
    let destroyClient = false;
    try {
      while (!locked && Date.now() < deadline) {
        const result = await client.query<{ locked: boolean }>(
          "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked",
          [lockName]
        );
        locked = result.rows[0]?.locked === true;
        if (!locked) await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (!locked) throw new ServiceUnavailableException("视觉智能生图排队超时，请稍后重试");
      return await request();
    } catch (error) {
      if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException("获取视觉智能生图限流锁失败");
    } finally {
      if (locked) {
        try {
          await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [lockName]);
        } catch {
          destroyClient = true;
        }
      }
      client.release(destroyClient);
    }
  }

  private async runSerially<T>(request: () => Promise<T>): Promise<T> {
    const previous = this.requestQueue;
    let release!: () => void;
    this.requestQueue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      return await request();
    } finally {
      release();
    }
  }
}
