import { randomUUID } from "node:crypto";
import { lookup as lookupDns } from "node:dns/promises";
import * as http from "node:http";
import * as https from "node:https";
import { isIP } from "node:net";
import { basename } from "node:path";
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import sharp from "sharp";
import { assetKey, AssetStorageService } from "../../common/asset-storage.service";
import { compressUploadedImage } from "../../common/image-compression";
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
const maxOutputImageBytes = 500 * 1024;
const maxImagePixels = 40_000_000;
const remoteImageTimeoutMs = 15_000;
const maxRemoteRedirects = 3;
const coverRatio = 3 / 4;
const coverRatioTolerance = 0.02;
const tempKeyPattern = /^[a-z0-9-]+(?:\.original)?\.(png|jpg|jpeg|webp)$/i;
const logger = new Logger("AdminRecipeImageService");

function imageSharp(buffer: Buffer) {
  return sharp(buffer, { limitInputPixels: maxImagePixels, failOn: "truncated" });
}

function getImageFormat(format: string | undefined): ImageMeta["extension"] | null {
  if (format === "jpeg") return "jpg";
  if (format === "png") return "png";
  if (format === "webp") return "webp";
  return null;
}

function imageMeta(format: ImageMeta["extension"], width: number, height: number): ImageMeta {
  const contentType = format === "jpg" ? "image/jpeg" : `image/${format}`;
  return { contentType, extension: format, width, height };
}

async function normalizeIngredientImage(buffer: Buffer): Promise<{ buffer: Buffer; meta: ImageMeta }> {
  if (!buffer.length || buffer.length > maxImageBytes) throw new BadRequestException("图片不能超过 10 MB");
  try {
    const output = await imageSharp(buffer)
      .rotate()
      .resize(500, 500, { fit: "contain", background: "#ffffff" })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (output.data.length > 250 * 1024) throw new BadRequestException("食材图片成品不能超过 250 KB");
    return { buffer: output.data, meta: imageMeta("jpg", output.info.width, output.info.height) };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("图片损坏或无法处理");
  }
}

async function normalizeImage(buffer: Buffer): Promise<{ buffer: Buffer; meta: ImageMeta }> {
  const image = await compressUploadedImage(buffer, {
    maxInputBytes: maxImageBytes,
    maxOutputBytes: maxOutputImageBytes,
    inputSizeMessage: "菜谱图片不能超过 10 MB",
    outputSizeMessage: "菜谱图片无法压缩到 500 KB 以内，请更换图片"
  });
  return {
    buffer: image.buffer,
    meta: imageMeta(image.extension, image.width, image.height)
  };
}

async function inspectStoredImage(buffer: Buffer): Promise<ImageMeta> {
  if (!buffer.length || buffer.length > maxOutputImageBytes) {
    throw new BadRequestException("菜谱图片成品不能超过 500 KB");
  }
  try {
    const image = imageSharp(buffer);
    const metadata = await image.metadata();
    const format = getImageFormat(metadata.format);
    if (!format) throw new BadRequestException("仅支持 JPG、PNG、WEBP 图片");
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > maxImagePixels) {
      throw new BadRequestException("图片像素不能超过 4000 万");
    }
    await image.stats();
    return imageMeta(format, metadata.width, metadata.height);
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("图片已损坏或无法解码");
  }
}

function assertSceneMeta(scene: AdminRecipeImageScene, meta: ImageMeta) {
  if (scene === "INGREDIENT" && (meta.width !== 500 || meta.height !== 500)) {
    throw new BadRequestException("食材图片必须为 500×500 像素");
  }
  if (scene !== "COVER") return;
  const ratio = meta.width / meta.height;
  if (!Number.isFinite(ratio) || Math.abs(ratio - coverRatio) > coverRatioTolerance) {
    throw new BadRequestException("系统菜谱封面图必须为 3:4");
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
      lookup(hostname, options, callback) {
        lookupDns(hostname, { all: true, verbatim: true })
          .then(addresses => {
            addresses.forEach(item => assertPublicAddress(item.address));
            if (options.all) {
              if (addresses.length === 0) throw new Error("remote address unavailable");
              callback(null, addresses);
              return;
            }
            const address = addresses[0];
            if (!address) throw new Error("remote address unavailable");
            callback(null, address.address, address.family);
          })
          .catch(error => {
            if (options.all) callback(error as Error, []);
            else callback(error as Error, "", 0);
          });
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
      const errorCode = error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : error instanceof Error && error.message === "remote image timeout"
          ? "ETIMEDOUT"
          : "NETWORK_ERROR";
      logger.warn(`Generated image download failed host=${safeUrl.hostname} reason=${errorCode}`);
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
    @Optional()
    private readonly remoteImageReader: RemoteImageReader = readRemoteImage
  ) {}

  buildPublicImageUrl(request: RequestLike, recipeId: number, fileName: string) {
    return this.assetStorage.publicUrl(request, this.finalKey(recipeId, fileName));
  }

  async stageTempImage(request: RequestLike, scene: AdminRecipeImageScene, file: FileUpload): Promise<AdminRecipeImageUploadResponse> {
    if (!file.buffer || typeof file.size !== "number") {
      throw new BadRequestException("请上传图片");
    }
    const normalized = scene === "INGREDIENT"
      ? await normalizeIngredientImage(file.buffer)
      : await normalizeImage(file.buffer);
    const meta = normalized.meta;
    assertSceneMeta(scene, meta);
    const tempKey = `${randomUUID()}.${meta.extension}`;
    await this.assetStorage.writeObject(this.tempStorageKey(tempKey), normalized.buffer, meta.contentType);
    return {
      image: {
        tempKey,
        scene,
        contentType: meta.contentType,
        sizeBytes: normalized.buffer.length,
        width: meta.width,
        height: meta.height
      }
    };
  }

  async stageGeneratedTempImageFromUrl(scene: AdminRecipeImageScene, imageUrl: string): Promise<AdminRecipeImageUploadResponse> {
    await assertSafeRemoteUrl(imageUrl);
    const source = await this.remoteImageReader(imageUrl);
    let buffer = source;
    if (scene === "COVER") {
      try {
        buffer = await imageSharp(source).rotate().resize(900, 1200, { fit: "cover", position: "attention" }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      } catch {
        throw new BadRequestException("生成的封面图无法裁切到 3:4，请重新生成");
      }
    }
    return this.stageTempImage({}, scene, { buffer, size: buffer.length });
  }

  async publishTempImage(request: RequestLike, recipeId: number, scene: AdminRecipeImageScene, tempKey: string) {
    const normalizedTempKey = this.normalizeTempKey(tempKey);
    let buffer: Buffer;
    try {
      buffer = await this.assetStorage.readBuffer(this.tempStorageKey(normalizedTempKey));
    } catch {
      throw new BadRequestException("图片上传状态已失效，请重新上传");
    }
    let meta: ImageMeta;
    let publishedBuffer = buffer;
    if (buffer.length <= maxOutputImageBytes) {
      meta = await inspectStoredImage(buffer);
    } else {
      const normalized = await normalizeImage(buffer);
      meta = normalized.meta;
      publishedBuffer = normalized.buffer;
    }
    assertSceneMeta(scene, meta);
    return this.writePublishedImage(request, recipeId, meta, publishedBuffer);
  }

  async readTempImageBuffer(tempKey: string) {
    const normalizedTempKey = this.normalizeTempKey(tempKey);
    try {
      return await this.assetStorage.readBuffer(this.tempStorageKey(normalizedTempKey));
    } catch {
      throw new BadRequestException("图片上传状态已失效，请重新生成");
    }
  }

  async publishImageBuffer(request: RequestLike, recipeId: number, scene: AdminRecipeImageScene, buffer: Buffer) {
    const normalized = await normalizeImage(buffer);
    assertSceneMeta(scene, normalized.meta);
    return this.writePublishedImage(request, recipeId, normalized.meta, normalized.buffer);
  }

  private async writePublishedImage(request: RequestLike, recipeId: number, meta: ImageMeta, buffer: Buffer) {
    if (buffer.length > maxOutputImageBytes) {
      throw new BadRequestException("菜谱图片成品不能超过 500 KB");
    }

    const fileName = `${randomUUID()}.${meta.extension}`;
    const storageKey = this.finalKey(recipeId, fileName);
    await this.assetStorage.writeObject(storageKey, buffer, meta.contentType);
    return {
      fileName,
      storageKey,
      imageUrl: this.buildPublicImageUrl(request, recipeId, fileName),
      sizeBytes: buffer.length
    };
  }

  async publishRemoteImage(request: RequestLike, recipeId: number, scene: AdminRecipeImageScene, imageUrl: string) {
    await assertSafeRemoteUrl(imageUrl);
    const buffer = await this.remoteImageReader(imageUrl);
    return this.publishImageBuffer(request, recipeId, scene, buffer);
  }

  async discardTempImages(tempKeys: Iterable<string>) {
    const keys = Array.from(new Set(Array.from(tempKeys).filter(Boolean)));
    if (!keys.length) return [] as string[];
    const results = await Promise.allSettled(keys.map(tempKey => this.assetStorage.deleteObject(this.tempStorageKey(this.normalizeTempKey(tempKey)))));
    return results.flatMap((result, index) => (result.status === "rejected" ? [keys[index] as string] : []));
  }

  async removePublishedImages(storageKeys: Iterable<string>) {
    const keys = Array.from(new Set(Array.from(storageKeys).filter(Boolean)));
    if (!keys.length) return [] as string[];
    const results = await Promise.allSettled(keys.map(storageKey => this.assetStorage.deleteObject(this.safeStorageKey(storageKey))));
    return results.flatMap((result, index) => (result.status === "rejected" ? [keys[index] as string] : []));
  }

  publishedStorageKeyFromUrl(imageUrl: string) {
    const normalized = imageUrl.trim();
    if (!normalized) return null;
    let pathname = normalized;
    try {
      pathname = new URL(normalized, "http://local.invalid").pathname;
    } catch {
      return null;
    }
    let candidate: string;
    try {
      candidate = decodeURIComponent(pathname).replace(/^\/+/, "").replace(/^static\//u, "");
    } catch {
      return null;
    }
    if (!/^uploads\/recipe-images\/\d+\/[^/]+$/i.test(candidate) && !/^uploads\/admin-recipe-images\/[^/]+$/i.test(candidate) && !/^admin-recipe-images\/[^/]+$/i.test(candidate)) {
      return null;
    }
    try {
      return this.safeStorageKey(candidate);
    } catch {
      return null;
    }
  }

  async getTempImageAsset(tempKey: string) {
    const normalizedTempKey = this.normalizeTempKey(tempKey);
    const contentType = this.getContentType(normalizedTempKey);
    const asset = await this.assetStorage.readObject(this.tempStorageKey(normalizedTempKey), contentType).catch(() => null);
    if (!asset) throw new NotFoundException("图片已失效，请重新上传");
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
    return assetKey("uploads", "recipe-images");
  }

  private tempDir() {
    return assetKey(this.imageDir(), ".tmp", "admin");
  }

  private tempStorageKey(tempKey: string) {
    return assetKey(this.tempDir(), tempKey);
  }

  private finalKey(recipeId: number, fileName: string) {
    return assetKey(this.imageDir(), recipeId, fileName);
  }

  private safeStorageKey(storageKey: string) {
    const key = storageKey.trim().replace(/^\/+/u, "");
    if (/^uploads\/recipe-images\/\d+\/[^/]+$/i.test(key)) return key;
    if (/^uploads\/admin-recipe-images\/[^/]+$/i.test(key)) return key;
    if (/^admin-recipe-images\/[^/]+$/i.test(key)) return assetKey("uploads", key);
    throw new BadRequestException("图片参数错误");
  }

  private getContentType(fileName: string) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
  }
}
