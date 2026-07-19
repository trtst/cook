import { HttpException } from "@nestjs/common";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export class RateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  assertAllowed(options: RateLimitOptions) {
    const now = Date.now();
    const bucket = this.buckets.get(options.key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(options.key, {
        count: 1,
        resetAt: now + options.windowMs
      });
      return;
    }

    bucket.count += 1;

    if (bucket.count > options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      throw new HttpException({
        code: 429,
        message: "请求过于频繁，请稍后重试",
        data: {
          retryAfterSeconds
        }
      }, 429);
    }
  }
}

export const rateLimitService = new RateLimitService();
