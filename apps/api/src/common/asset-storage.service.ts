import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Readable } from "node:stream";

type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

type AssetStorageDriver = "local" | "oss";

type AssetStorageConfig = {
  driver: AssetStorageDriver;
  localRoot: string;
  prefix: string;
  oss?: {
    region: string;
    bucket: string;
    endpoint: string;
    accessKeyId: string;
    accessKeySecret: string;
  };
};

export type AssetObject = {
  contentType: string;
  size: number;
  stream: Readable;
};

type OssClient = {
  put: (key: string, body: Buffer, options?: { headers?: Record<string, string> }) => Promise<unknown>;
  getStream: (key: string) => Promise<{ stream: Readable; res?: { headers?: Record<string, string | string[] | undefined> } }>;
  head: (key: string) => Promise<{ res?: { headers?: Record<string, string | string[] | undefined> } }>;
  delete: (key: string) => Promise<unknown>;
  copy: (targetKey: string, sourceKey: string) => Promise<unknown>;
  list: (query: { prefix: string; "max-keys": number }) => Promise<{ objects?: Array<{ name?: string }> }>;
};

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value || "";
}

function requiredEnv(name: string) {
  const value = envValue(name);
  if (!value) throw new Error(`${name} is required when ASSET_STORAGE_DRIVER=oss`);
  return value;
}

function assetRoot() {
  return resolve(envValue("APP_ASSET_DIR") || join(process.cwd(), "var", "app-assets"));
}

function cleanPrefix(value: string) {
  const prefix = value.trim().replace(/^\/+|\/+$/gu, "");
  if (prefix.includes("..") || prefix.includes("\\")) {
    throw new Error("ASSET_STORAGE_PREFIX must be a safe relative path");
  }
  return prefix;
}

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/u, "");
}

function cleanStorageKey(storageKey: string) {
  const key = storageKey.trim().replace(/^\/+/u, "");
  if (!key || key.includes("..") || key.includes("\\")) {
    throw new NotFoundException("图片不存在");
  }
  return key;
}

function toPublicPath(storageKey: string) {
  const key = cleanStorageKey(storageKey);
  return key.startsWith("uploads/") ? `/${key}` : `/uploads/${key}`;
}

export function assetKey(...segments: Array<string | number>) {
  return segments
    .map(segment => String(segment).trim().replace(/^\/+|\/+$/gu, ""))
    .filter(Boolean)
    .join("/");
}

function contentTypeFromKey(storageKey: string) {
  const lower = storageKey.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

function headerValue(headers: Record<string, string | string[] | undefined> | undefined, name: string) {
  if (!headers) return "";
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export function loadAssetStorageConfig(): AssetStorageConfig {
  const driverValue = envValue("ASSET_STORAGE_DRIVER") || "local";
  if (driverValue !== "local" && driverValue !== "oss") {
    throw new Error("ASSET_STORAGE_DRIVER must be local or oss");
  }

  if (driverValue === "local") {
    return {
      driver: "local",
      localRoot: assetRoot(),
      prefix: cleanPrefix(envValue("ASSET_STORAGE_PREFIX"))
    };
  }

  return {
    driver: "oss",
    localRoot: assetRoot(),
    prefix: cleanPrefix(envValue("ASSET_STORAGE_PREFIX")),
    oss: {
      region: requiredEnv("OSS_REGION"),
      bucket: requiredEnv("OSS_BUCKET"),
      endpoint: requiredEnv("OSS_ENDPOINT"),
      accessKeyId: requiredEnv("OSS_ACCESS_KEY_ID"),
      accessKeySecret: requiredEnv("OSS_ACCESS_KEY_SECRET")
    }
  };
}

export function assetPublicUrl(request: RequestLike, storageKey: string, updatedAt?: Date | null) {
  const publicPath = toPublicPath(storageKey);
  const configuredBaseUrl = cleanBaseUrl(envValue("ASSET_PUBLIC_BASE_URL"));
  const baseUrl = configuredBaseUrl || (() => {
    const protocol = request.protocol || "http";
    const host = request.get?.("host");
    return host ? `${protocol}://${host}` : "";
  })();
  const url = configuredBaseUrl ? `${baseUrl}${publicPath}` : `${baseUrl}/static${publicPath}`;
  if (!updatedAt) return url;
  return `${url}?v=${encodeURIComponent(updatedAt.toISOString())}`;
}

@Injectable()
export class AssetStorageService {
  private readonly config = loadAssetStorageConfig();
  private ossClient: OssClient | null = null;

  publicUrl(request: RequestLike, storageKey: string, updatedAt?: Date | null) {
    return assetPublicUrl(request, storageKey, updatedAt);
  }

  async writeObject(storageKey: string, buffer: Buffer, contentType: string) {
    const key = cleanStorageKey(storageKey);
    const objectKey = this.objectKey(key);
    if (this.config.driver === "oss") {
      const client = this.oss();
      await client.put(objectKey, buffer, { headers: { "Content-Type": contentType } });
      return;
    }
    const filePath = this.localPath(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
  }

  async readObject(storageKey: string, contentType?: string): Promise<AssetObject> {
    const key = cleanStorageKey(storageKey);
    const objectKey = this.objectKey(key);
    if (this.config.driver === "oss") {
      try {
        const client = this.oss();
        const [streamResult, headResult] = await Promise.all([client.getStream(objectKey), client.head(objectKey)]);
        const headers = headResult.res?.headers ?? streamResult.res?.headers;
        const size = Number(headerValue(headers, "content-length")) || 0;
        return {
          contentType: contentType || headerValue(headers, "content-type") || contentTypeFromKey(key),
          size,
          stream: streamResult.stream
        };
      } catch {
        throw new NotFoundException("图片不存在");
      }
    }

    const filePath = this.localPath(key);
    try {
      const stats = await stat(filePath);
      return {
        contentType: contentType || contentTypeFromKey(key),
        size: stats.size,
        stream: createReadStream(filePath)
      };
    } catch {
      throw new NotFoundException("图片不存在");
    }
  }

  async readBuffer(storageKey: string) {
    const key = cleanStorageKey(storageKey);
    if (this.config.driver === "oss") {
      const asset = await this.readObject(key);
      const chunks: Buffer[] = [];
      for await (const chunk of asset.stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    return readFile(this.localPath(key));
  }

  async exists(storageKey: string) {
    const key = cleanStorageKey(storageKey);
    const objectKey = this.objectKey(key);
    if (this.config.driver === "oss") {
      try {
        const client = this.oss();
        await client.head(objectKey);
        return true;
      } catch {
        return false;
      }
    }
    return Boolean(await stat(this.localPath(key)).catch(() => null));
  }

  async deleteObject(storageKey: string) {
    const key = cleanStorageKey(storageKey);
    const objectKey = this.objectKey(key);
    if (this.config.driver === "oss") {
      const client = this.oss();
      await client.delete(objectKey);
      return;
    }
    await rm(this.localPath(key), { force: true });
  }

  async copyObject(sourceKey: string, targetKey: string) {
    const source = cleanStorageKey(sourceKey);
    const target = cleanStorageKey(targetKey);
    if (this.config.driver === "oss") {
      const client = this.oss();
      await client.copy(this.objectKey(target), this.objectKey(source));
      return;
    }
    await this.writeObject(target, await readFile(this.localPath(source)), contentTypeFromKey(target));
  }

  async moveObject(sourceKey: string, targetKey: string) {
    const source = cleanStorageKey(sourceKey);
    const target = cleanStorageKey(targetKey);
    await this.copyObject(source, target);
    await this.deleteObject(source);
  }

  async listObjects(prefix: string) {
    const cleanPrefix = cleanStorageKey(prefix).replace(/\/?$/u, "/");
    if (this.config.driver === "oss") {
      const client = this.oss();
      const objectPrefix = this.objectKey(cleanPrefix);
      const result = await client.list({ prefix: objectPrefix, "max-keys": 1000 });
      return (result.objects ?? [])
        .map(item => item.name)
        .filter((name): name is string => Boolean(name))
        .map(name => this.logicalKey(name));
    }

    const root = this.localPath(cleanPrefix);
    const names = await readdir(root).catch(() => []);
    return names.map(name => `${cleanPrefix}${name}`);
  }

  private localPath(storageKey: string) {
    return join(this.config.localRoot, this.objectKey(storageKey));
  }

  private objectKey(storageKey: string) {
    const key = cleanStorageKey(storageKey);
    return this.config.prefix ? assetKey(this.config.prefix, key) : key;
  }

  private logicalKey(objectKey: string) {
    const key = cleanStorageKey(objectKey);
    if (!this.config.prefix) return key;
    const prefix = `${this.config.prefix}/`;
    return key.startsWith(prefix) ? key.slice(prefix.length) : key;
  }

  private oss() {
    if (!this.config.oss) throw new Error("OSS storage is not configured");
    if (!this.ossClient) {
      const OSS = require("ali-oss");
      this.ossClient = new OSS({
        region: this.config.oss.region,
        bucket: this.config.oss.bucket,
        endpoint: this.config.oss.endpoint,
        accessKeyId: this.config.oss.accessKeyId,
        accessKeySecret: this.config.oss.accessKeySecret
      });
    }
    return this.ossClient as OssClient;
  }
}
