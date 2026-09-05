import { randomUUID } from "node:crypto";
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

@Injectable()
export class AdminRecipeImageService {
  constructor(private readonly assetStorage: AssetStorageService) {}

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
