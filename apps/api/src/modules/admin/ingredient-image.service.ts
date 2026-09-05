import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { assetKey, AssetStorageService } from "../../common/asset-storage.service";
import type { UUID } from "../../contracts/types";

type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const ingredientImageSize = 50;
const maxImageBytes = 5 * 1024 * 1024;

function isPng(buffer: Buffer) {
  return (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function readPngSize(buffer: Buffer) {
  if (!isPng(buffer) || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

@Injectable()
export class IngredientImageService {
  constructor(@Inject(AssetStorageService) private readonly assetStorage: AssetStorageService) {}

  buildImageUrl(request: RequestLike, ingredientId: UUID, updatedAt: Date | null) {
    if (!updatedAt) return null;
    return this.assetStorage.publicUrl(request, this.getPublicKey(ingredientId), updatedAt);
  }

  async stageImageUpload(ingredientId: UUID, file: { buffer?: Buffer; size?: number } | undefined) {
    if (!file?.buffer || typeof file.size !== "number") {
      throw new BadRequestException("请上传食材图片");
    }
    if (file.size <= 0 || file.size > maxImageBytes) {
      throw new BadRequestException("图片大小不能超过 5 MB");
    }

    const size = readPngSize(file.buffer);
    if (!size) {
      throw new BadRequestException("仅支持 PNG 图片");
    }
    if (size.width !== ingredientImageSize || size.height !== ingredientImageSize) {
      throw new BadRequestException("请上传 50x50 的 PNG 图片");
    }

    const tempPath = this.getTempPath(ingredientId);
    await this.assetStorage.writeObject(tempPath, file.buffer, "image/png");
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
    const asset = await this.assetStorage.readObject(this.getImagePath(ingredientId), "image/png").catch(() => null);
    if (!asset) {
      throw new NotFoundException("食材图片不存在");
    }
    return {
      contentType: asset.contentType,
      stream: asset.stream,
      stat: { size: asset.size }
    };
  }

  private getImageDir() {
    return assetKey("uploads", "ingredients");
  }

  private getPublicKey(ingredientId: UUID) {
    return assetKey(this.getImageDir(), ingredientId);
  }

  private getImagePath(ingredientId: UUID) {
    return assetKey(this.getImageDir(), `${ingredientId}.png`);
  }

  private getTempDir() {
    return assetKey(this.getImageDir(), ".tmp");
  }

  private getTempPath(ingredientId: UUID) {
    return assetKey(this.getTempDir(), `${ingredientId}-${randomUUID()}.png`);
  }

  private getBackupPath(ingredientId: UUID) {
    return assetKey(this.getTempDir(), `${ingredientId}-${randomUUID()}.bak`);
  }
}
