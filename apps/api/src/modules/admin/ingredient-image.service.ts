import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { UUID } from "../../contracts/types";

type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const ingredientImageSize = 50;
const maxImageBytes = 5 * 1024 * 1024;

function getAssetRoot() {
  return resolve(process.env.APP_ASSET_DIR || join(process.cwd(), "var", "app-assets"));
}

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
  buildImageUrl(request: RequestLike, ingredientId: UUID, updatedAt: Date | null) {
    if (!updatedAt) return null;
    const protocol = request.protocol || "http";
    const host = request.get?.("host");
    const path = `/api/public-assets/ingredients/${ingredientId}?v=${encodeURIComponent(updatedAt.toISOString())}`;
    if (!host) return path;
    return `${protocol}://${host}${path}`;
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
    await mkdir(this.getTempDir(), { recursive: true });
    await writeFile(tempPath, file.buffer);
    return tempPath;
  }

  async replaceStagedImage(ingredientId: UUID, tempPath: string) {
    const imagePath = this.getImagePath(ingredientId);
    const backupPath = this.getBackupPath(ingredientId);
    await mkdir(this.getImageDir(), { recursive: true });
    await mkdir(this.getTempDir(), { recursive: true });
    await rm(backupPath, { force: true });
    try {
      await rename(imagePath, backupPath);
    } catch {
      // No existing image file to back up.
    }
    try {
      await rename(tempPath, imagePath);
    } catch (error) {
      try {
        await rename(backupPath, imagePath);
      } catch {
        // Best effort restore. Upper layer will still surface failure.
      }
      throw error;
    }
    return backupPath;
  }

  async rollbackReplacedImage(ingredientId: UUID, backupPath: string | null) {
    const imagePath = this.getImagePath(ingredientId);
    await rm(imagePath, { force: true });
    if (!backupPath) return;
    try {
      await rename(backupPath, imagePath);
    } catch {
      // Best effort rollback. Public reads are still gated by database state.
    }
  }

  async finalizeReplacedImage(backupPath: string | null) {
    if (!backupPath) return;
    await rm(backupPath, { force: true });
  }

  async stageClearImage(ingredientId: UUID) {
    const imagePath = this.getImagePath(ingredientId);
    const backupPath = this.getBackupPath(ingredientId);
    await mkdir(this.getTempDir(), { recursive: true });
    await rm(backupPath, { force: true });
    try {
      await rename(imagePath, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  async rollbackClearedImage(ingredientId: UUID, backupPath: string | null) {
    if (!backupPath) return;
    const imagePath = this.getImagePath(ingredientId);
    await rm(imagePath, { force: true });
    try {
      await rename(backupPath, imagePath);
    } catch {
      // Best effort rollback. Public reads are still gated by database state.
    }
  }

  async finalizeClearedImage(backupPath: string | null) {
    if (!backupPath) return;
    await rm(backupPath, { force: true });
  }

  async discardStagedImage(tempPath: string | null) {
    if (!tempPath) return;
    await rm(tempPath, { force: true });
  }

  async getImageAsset(ingredientId: UUID) {
    const filePath = this.getImagePath(ingredientId);
    try {
      return {
        contentType: "image/png",
        stream: createReadStream(filePath),
        stat: await stat(filePath)
      };
    } catch {
      throw new NotFoundException("食材图片不存在");
    }
  }

  private getImageDir() {
    return join(getAssetRoot(), "ingredients");
  }

  private getImagePath(ingredientId: UUID) {
    return join(this.getImageDir(), `${ingredientId}.png`);
  }

  private getTempDir() {
    return join(getAssetRoot(), "ingredients-temp");
  }

  private getTempPath(ingredientId: UUID) {
    return join(this.getTempDir(), `${ingredientId}-${randomUUID()}.png`);
  }

  private getBackupPath(ingredientId: UUID) {
    return join(this.getTempDir(), `${ingredientId}-${randomUUID()}.bak`);
  }
}
