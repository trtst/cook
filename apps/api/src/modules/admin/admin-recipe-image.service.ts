import { randomUUID } from "node:crypto";
import { lookup as lookupDns } from "node:dns/promises";
import * as http from "node:http";
import * as https from "node:https";
import { isIP } from "node:net";
import { basename } from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { assetKey, AssetStorageService } from "../../common/asset-storage.service";
import type { AdminRecipeImageScene, AdminRecipeImageUploadResponse } from "../../contracts/types";

type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

type FileUpload = {
  buffer?: Buffer;
  size?: number;
};

type ImageMeta = {
  contentType: string;
  extension: string;
  width: number;
  height: number;
};

const maxImageBytes = 10 * 1024 * 1024;
const remoteImageTimeoutMs = 15_000;
const maxRemoteRedirects = 3;
const coverRatio = 4 / 3;
const coverRatioTolerance = 0.02;
const tempKeyPattern = /^[a-z0-9-]+\.(png|jpg|jpeg|webp)$/i;

function readPngSize(buffer: Buffer) {
  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47 ||
    buffer.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function readJpegSize(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const blockSize = buffer.readUInt16BE(offset + 2);
    if (blockSize < 2 || offset + blockSize + 2 > buffer.length) break;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += blockSize + 2;
  }
  return null;
}

function readWebpSize(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii");
  if (chunkType === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }

  if (chunkType === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }

  if (chunkType === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }

  return null;
}

function detectImageMeta(file: FileUpload): ImageMeta {
  if (!file.buffer || typeof file.size !== "number") {
    throw new BadRequestException("请上传图片");
  }
  if (file.size <= 0 || file.size > maxImageBytes) {
    throw new BadRequestException("图片大小不能超过 10 MB");
  }

  const png = readPngSize(file.buffer);
  if (png) {
    return {
      contentType: "image/png",
      extension: "png",
      width: png.width,
      height: png.height
    };
  }

  const jpeg = readJpegSize(file.buffer);
  if (jpeg) {
    return {
      contentType: "image/jpeg",
      extension: "jpg",
      width: jpeg.width,
      height: jpeg.height
    };
  }

  const webp = readWebpSize(file.buffer);
  if (webp) {
    return {
      contentType: "image/webp",
      extension: "webp",
      width: webp.width,
      height: webp.height
    };
  }

  throw new BadRequestException("仅支持 JPG、PNG、WEBP 图片");
}

function assertSceneMeta(scene: AdminRecipeImageScene, meta: ImageMeta) {
  if (scene !== "COVER") return;
  const ratio = meta.width / meta.height;
  if (!Number.isFinite(ratio) || Math.abs(ratio - coverRatio) > coverRatioTolerance) {
    throw new BadRequestException("系统菜谱封面图必须为 4:3");
  }
}

function normalizeRemoteHostname(hostname: string) {
  return hostname.replace(/^\[|\]$/gu, "").toLowerCase();
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 100 && b >= 64 && b <= 127 ||
    a === 127 ||
    a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 ||
    a === 192 && (b === 0 || b === 168) ||
    a === 192 && b === 88 && c === 99 ||
    a === 198 && (b === 18 || b === 19 || b === 51) ||
    a === 203 && b === 0 && c === 113 ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("ff")) {
    return true;
  }
  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
}

function assertPublicAddress(address: string) {
  const version = isIP(address);
  if (version === 4 && isPrivateIpv4(address)) throw new BadRequestException("远程图片地址不安全");
  if (version === 6 && isPrivateIpv6(address)) throw new BadRequestException("远程图片地址不安全");
  if (version === 0) throw new BadRequestException("远程图片地址不安全");
}

async function assertSafeRemoteUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new BadRequestException("远程图片地址无效");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BadRequestException("远程图片只支持 HTTP 或 HTTPS");
  }
  if (url.username || url.password || (url.port && url.port !== "80" && url.port !== "443")) {
    throw new BadRequestException("远程图片地址不安全");
  }
  const hostname = normalizeRemoteHostname(url.hostname);
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new BadRequestException("远程图片地址不安全");
  }
  if (isIP(hostname)) {
    assertPublicAddress(hostname);
    return url;
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookupDns(hostname, { all: true, verbatim: true });
  } catch {
    throw new BadRequestException("远程图片地址无法解析");
  }
  if (addresses.length === 0) throw new BadRequestException("远程图片地址无法解析");
  addresses.forEach(item => assertPublicAddress(item.address));
  return url;
}

function readRemoteResponse(url: URL) {
  return new Promise<{ status: number; contentType: string; contentLength: number; location: string | null; buffer: Buffer | null }>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.get({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      headers: {
        accept: "image/jpeg,image/png,image/webp"
      },
      lookup(hostname, _options, callback) {
        lookupDns(hostname, { all: true, verbatim: true })
          .then(addresses => {
            addresses.forEach(item => assertPublicAddress(item.address));
            const address = addresses[0]?.address;
            if (!address) throw new Error("remote address unavailable");
            callback(null, address, isIP(address));
          })
          .catch(error => callback(error as Error, "", 0));
      }
    }, response => {
      const status = response.statusCode ?? 0;
      const contentType = Array.isArray(response.headers["content-type"])
        ? response.headers["content-type"][0] ?? ""
        : response.headers["content-type"] ?? "";
      const contentLength = Number(response.headers["content-length"] ?? 0);
      const location = Array.isArray(response.headers.location)
        ? response.headers.location[0] ?? null
        : response.headers.location ?? null;

      if ((status >= 300 && status < 400) || status < 200 || status >= 300) {
        response.resume();
        response.once("end", () => resolve({ status, contentType, contentLength, location, buffer: null }));
        return;
      }
      if (contentLength > maxImageBytes) {
        response.destroy(new Error("remote image too large"));
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", chunk => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > maxImageBytes) {
          response.destroy(new Error("remote image too large"));
          return;
        }
        chunks.push(buffer);
      });
      response.once("end", () => resolve({
        status,
        contentType,
        contentLength,
        location,
        buffer: Buffer.concat(chunks)
      }));
      response.once("error", reject);
    });
    request.setTimeout(remoteImageTimeoutMs, () => request.destroy(new Error("remote image timeout")));
    request.once("error", reject);
  });
}

async function readRemoteImage(url: string) {
  let nextUrl = url;
  for (let redirectCount = 0; redirectCount <= maxRemoteRedirects; redirectCount += 1) {
    const safeUrl = await assertSafeRemoteUrl(nextUrl);
    let response: Awaited<ReturnType<typeof readRemoteResponse>>;
    try {
      response = await readRemoteResponse(safeUrl);
    } catch (error) {
      if (error instanceof Error && error.message === "remote image too large") {
        throw new BadRequestException("远程图片大小不能超过 10 MB");
      }
      throw new BadRequestException("远程图片下载失败或超时");
    }

    if (response.status >= 300 && response.status < 400) {
      if (!response.location || redirectCount === maxRemoteRedirects) throw new BadRequestException("远程图片重定向次数过多");
      try {
        nextUrl = new URL(response.location, safeUrl).toString();
      } catch {
        throw new BadRequestException("远程图片重定向地址无效");
      }
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new BadRequestException("远程图片下载失败");
    const contentType = response.contentType.split(";", 1)[0]?.trim().toLowerCase() || "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      throw new BadRequestException("远程地址返回的不是支持的图片");
    }
    if (response.contentLength > maxImageBytes) throw new BadRequestException("远程图片大小不能超过 10 MB");
    if (!response.buffer?.length) throw new BadRequestException("远程图片内容为空");
    return response.buffer;
  }
  throw new BadRequestException("远程图片下载失败");
}

type RemoteImageReader = (url: string) => Promise<Buffer>;

@Injectable()
export class AdminRecipeImageService {
  constructor(
    private readonly assetStorage: AssetStorageService,
    private readonly remoteImageReader: RemoteImageReader = readRemoteImage
  ) {}

  buildPublicImageUrl(request: RequestLike, fileName: string) {
    return this.assetStorage.publicUrl(request, this.finalKey(fileName));
  }

  async stageTempImage(request: RequestLike, scene: AdminRecipeImageScene, file: FileUpload): Promise<AdminRecipeImageUploadResponse> {
    const meta = detectImageMeta(file);
    assertSceneMeta(scene, meta);
    const tempKey = `${randomUUID()}.${meta.extension}`;
    await this.assetStorage.writeObject(this.tempStorageKey(tempKey), file.buffer as Buffer, meta.contentType);
    return {
      image: {
        tempKey,
        scene,
        contentType: meta.contentType,
        sizeBytes: file.size as number,
        width: meta.width,
        height: meta.height
      }
    };
  }

  async publishTempImage(request: RequestLike, scene: AdminRecipeImageScene, tempKey: string) {
    const normalizedTempKey = this.normalizeTempKey(tempKey);
    let buffer: Buffer;
    try {
      buffer = await this.assetStorage.readBuffer(this.tempStorageKey(normalizedTempKey));
    } catch {
      throw new BadRequestException("图片上传状态已失效，请重新上传");
    }
    const published = await this.publishImageBuffer(request, scene, buffer);
    return published;
  }

  async publishImageBuffer(request: RequestLike, scene: AdminRecipeImageScene, buffer: Buffer) {
    const meta = detectImageMeta({ buffer, size: buffer.length });
    assertSceneMeta(scene, meta);

    const fileName = `${randomUUID()}.${meta.extension}`;
    const storageKey = this.finalKey(fileName);
    await this.assetStorage.writeObject(storageKey, buffer, meta.contentType);
    return {
      fileName,
      storageKey,
      imageUrl: this.buildPublicImageUrl(request, fileName)
    };
  }

  async publishRemoteImage(request: RequestLike, scene: AdminRecipeImageScene, imageUrl: string) {
    await assertSafeRemoteUrl(imageUrl);
    const buffer = await this.remoteImageReader(imageUrl);
    return this.publishImageBuffer(request, scene, buffer);
  }

  async discardTempImages(tempKeys: Iterable<string>) {
    const keys = Array.from(new Set(Array.from(tempKeys).filter(Boolean)));
    if (!keys.length) return;
    await Promise.allSettled(keys.map(tempKey => this.assetStorage.deleteObject(this.tempStorageKey(this.normalizeTempKey(tempKey)))));
  }

  async removePublishedImages(storageKeys: Iterable<string>) {
    const keys = Array.from(new Set(Array.from(storageKeys).filter(Boolean)));
    if (!keys.length) return;
    await Promise.allSettled(keys.map(storageKey => this.assetStorage.deleteObject(this.safeStorageKey(storageKey))));
  }

  async getPublicImageAsset(fileName: string) {
    const normalizedName = this.normalizeTempKey(fileName);
    const contentType = this.getContentType(normalizedName);
    const asset = await this.assetStorage.readObject(this.finalKey(normalizedName), contentType).catch(() => null);
    if (!asset) throw new NotFoundException("图片不存在");
    return {
      contentType,
      stream: asset.stream,
      stat: { size: asset.size }
    };
  }

  private normalizeTempKey(tempKey: string) {
    const name = basename(tempKey.trim());
    if (!tempKeyPattern.test(name)) {
      throw new BadRequestException("图片参数错误");
    }
    return name;
  }

  private imageDir() {
    return assetKey("uploads", "admin-recipe-images");
  }

  private tempDir() {
    return assetKey(this.imageDir(), ".tmp");
  }

  private tempStorageKey(tempKey: string) {
    return assetKey(this.tempDir(), tempKey);
  }

  private finalKey(fileName: string) {
    return assetKey(this.imageDir(), fileName);
  }

  private safeStorageKey(storageKey: string) {
    const key = storageKey.trim().replace(/^\/+/u, "");
    const publicPrefix = `${this.imageDir()}/`;
    const legacyPrefix = "admin-recipe-images/";
    if (key.startsWith(publicPrefix)) return key;
    if (key.startsWith(legacyPrefix)) return assetKey("uploads", key);
    throw new BadRequestException("图片参数错误");
  }

  private getContentType(fileName: string) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
  }
}
