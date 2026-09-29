import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { assetKey, AssetStorageService } from "../../common/asset-storage.service";
import type { UUID } from "../../contracts/types";

type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const minImageSize = 60;
const maxImageSize = 100;
const maxImageBytes = 2 * 1024 * 1024;
const jpegStart = 0xd8;
const jpegEnd = 0xd9;
const jpegStartOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function readJpegSize(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== jpegStart) return null;

  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === jpegEnd || marker === 0x00) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= buffer.length) return null;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
    if (jpegStartOfFrame.has(marker)) {
      if (segmentLength < 7) return null;
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += segmentLength;
  }

  return null;
}

@Injectable()
export class IngredientImageService {
  constructor(@Inject(AssetStorageService) private readonly assetStorage: AssetStorageService) {}

  buildImageUrl(imageUrl: string | null, request?: RequestLike) {
    if (!imageUrl || /^https?:\/\//iu.test(imageUrl) || !request) return imageUrl;
    const host = request.get?.("host");
    if (!host) return imageUrl;
    const protocol = request.protocol || "http";
    return `${protocol}://${host}${imageUrl}`;
  }

  buildStoredImageUrl(request: RequestLike, ingredientId: UUID, updatedAt: Date) {
    const generatedUrl = this.assetStorage.publicUrl(request, this.getImagePath(ingredientId), updatedAt);
    const parsedUrl = new URL(generatedUrl, "http://asset.local");
    const stableUrl = this.assetStorage.isConfiguredPublicUrl(generatedUrl)
      ? generatedUrl
      : `${parsedUrl.pathname}${parsedUrl.search}`;
    const separator = stableUrl.includes("?") ? "&" : "?";
    return `${stableUrl}${separator}x-oss-process=image/resize,m_fixed,w_60,h_60`;
  }

  async stageImageUpload(ingredientId: UUID, file: { buffer?: Buffer; size?: number } | undefined) {
    if (!file?.buffer || typeof file.size !== "number") {
      throw new BadRequestException("请上传食材图片");
    }
    if (file.size <= 0 || file.size > maxImageBytes) {
      throw new BadRequestException("图片大小不能超过 2 MB");
    }

    const size = readJpegSize(file.buffer);
    if (!size) {
      throw new BadRequestException("请上传 JPG 图片");
    }
    if (size.width !== size.height) {
      throw new BadRequestException("食材图片必须是 1:1 正方形");
    }
    if (size.width < minImageSize || size.height < minImageSize) {
      throw new BadRequestException("食材图片尺寸不能小于 60×60 像素");
    }
    if (size.width > maxImageSize || size.height > maxImageSize) {
      throw new BadRequestException("食材图片最长边不能超过 100 像素");
    }

    const tempPath = this.getTempPath(ingredientId);
    await this.assetStorage.writeObject(tempPath, file.buffer, "image/jpeg");
    return tempPath;
  }

  async replaceStagedImage(ingredientId: UUID, tempPath: string) {
    const imagePath = this.getImagePath(ingredientId);
    const backupPath = this.getBackupPath(ingredientId);
    await this.assetStorage.deleteObject(backupPath);
    try {
      await this.assetStorage.moveObject(imagePath, backupPath);
    } catch {
      // No existing image file to back up.
    }
    try {
      await this.assetStorage.moveObject(tempPath, imagePath);
    } catch (error) {
      try {
        await this.assetStorage.moveObject(backupPath, imagePath);
      } catch {
        // Best effort restore. Upper layer will still surface failure.
      }
      throw error;
    }
    return backupPath;
  }

  async rollbackReplacedImage(ingredientId: UUID, backupPath: string | null) {
    const imagePath = this.getImagePath(ingredientId);
    await this.assetStorage.deleteObject(imagePath);
    if (!backupPath) return;
    try {
      await this.assetStorage.moveObject(backupPath, imagePath);
    } catch {
      // Best effort rollback. Public reads are still gated by database state.
    }
  }

  async finalizeReplacedImage(backupPath: string | null) {
    if (!backupPath) return;
    await this.assetStorage.deleteObject(backupPath);
  }

  async stageClearImage(ingredientId: UUID) {
    const imagePath = this.getImagePath(ingredientId);
    const backupPath = this.getBackupPath(ingredientId);
    await this.assetStorage.deleteObject(backupPath);
    try {
      await this.assetStorage.moveObject(imagePath, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  async rollbackClearedImage(ingredientId: UUID, backupPath: string | null) {
    if (!backupPath) return;
    const imagePath = this.getImagePath(ingredientId);
    await this.assetStorage.deleteObject(imagePath);
    try {
      await this.assetStorage.moveObject(backupPath, imagePath);
    } catch {
      // Best effort rollback. Public reads are still gated by database state.
    }
  }

  async finalizeClearedImage(backupPath: string | null) {
    if (!backupPath) return;
    await this.assetStorage.deleteObject(backupPath);
  }

  async discardStagedImage(tempPath: string | null) {
    if (!tempPath) return;
    await this.assetStorage.deleteObject(tempPath);
  }

  async getImageAsset(ingredientId: UUID) {
    const asset = await this.assetStorage.readObject(this.getImagePath(ingredientId), "image/jpeg").catch(() => null);
    if (!asset) {
      throw new NotFoundException("食材图片不存在");
    }
    return {
      contentType: asset.contentType,
      stream: asset.stream,
      stat: { size: asset.size }
    };
  }

  getImagePath(ingredientId: UUID) {
    return assetKey(this.getImageDir(), `${ingredientId}.jpg`);
  }

  private getImageDir() {
    return assetKey("uploads", "ingredients");
  }

  private getTempDir() {
    return assetKey(this.getImageDir(), ".tmp");
  }

  private getTempPath(ingredientId: UUID) {
    return assetKey(this.getTempDir(), `${ingredientId}-${randomUUID()}.jpg`);
  }

  private getBackupPath(ingredientId: UUID) {
    return assetKey(this.getTempDir(), `${ingredientId}-${randomUUID()}.bak`);
  }
}
