import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { assetKey, AssetStorageService } from "../../common/asset-storage.service";
import type { UUID } from "../../contracts/types";

type ImageKind = "jpeg" | "png" | "webp";

const maxImageBytes = 5 * 1024 * 1024;

function detectKind(buffer: Buffer): ImageKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

function getType(kind: ImageKind) {
  if (kind === "jpeg") return "image/jpeg";
  if (kind === "png") return "image/png";
  return "image/webp";
}

function getExt(kind: ImageKind) {
  if (kind === "jpeg") return "jpg";
  if (kind === "png") return "png";
  return "webp";
}

function kindOf(path: string): ImageKind {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  return "jpeg";
}

@Injectable()
export class HomeTopicImageService {
  constructor(@Inject(AssetStorageService) private readonly assetStorage: AssetStorageService) {}

  buildImagePath(topicId: UUID) {
    return this.assetStorage.publicUrl({}, assetKey("uploads", "home-topics", topicId));
  }

  async stageUpload(file: { buffer?: Buffer; size?: number } | undefined) {
    if (!file?.buffer || typeof file.size !== "number") {
      throw new BadRequestException("请上传本周灵感专题封面图");
    }
    if (file.size <= 0 || file.size > maxImageBytes) {
      throw new BadRequestException("图片大小不能超过 5 MB");
    }

    const kind = detectKind(file.buffer);
    if (!kind) {
      throw new BadRequestException("仅支持 JPG、PNG、WEBP 图片");
    }

    const tempPath = this.tempKey(kind);
    await this.assetStorage.writeObject(tempPath, file.buffer, getType(kind));
    return { tempPath, kind };
  }

  async replaceImage(topicId: UUID, tempPath: string, kind: ImageKind) {
    const current = await this.findImage(topicId);
    const nextPath = this.imagePath(topicId, kind);
    const backupPath = current ? this.backupPath(topicId, current.kind) : null;

    if (backupPath) {
      await this.assetStorage.deleteObject(backupPath);
    }

    if (current) {
      try {
        await this.assetStorage.moveObject(current.path, backupPath as string);
      } catch {
        // Best effort backup.
      }
    }

    try {
      await this.clearImage(topicId);
      await this.assetStorage.moveObject(tempPath, nextPath);
    } catch (error) {
      if (backupPath) {
        try {
          await this.assetStorage.moveObject(backupPath, current?.path ?? this.imagePath(topicId, kind));
        } catch {
          // Best effort rollback.
        }
      }
      throw error;
    }

    return backupPath;
  }

  async rollbackReplace(topicId: UUID, backupPath: string | null) {
    await this.clearImage(topicId);
    if (!backupPath) return;
    try {
      await this.assetStorage.moveObject(backupPath, this.imagePath(topicId, kindOf(backupPath)));
    } catch {
      // Best effort rollback.
    }
  }

  async finishReplace(backupPath: string | null) {
    if (!backupPath) return;
    await this.assetStorage.deleteObject(backupPath);
  }

  async stageClear(topicId: UUID) {
    const current = await this.findImage(topicId);
    if (!current) return null;
    const backupPath = this.backupPath(topicId, current.kind);
    await this.assetStorage.deleteObject(backupPath);
    try {
      await this.assetStorage.moveObject(current.path, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  async rollbackClear(topicId: UUID, backupPath: string | null) {
    if (!backupPath) return;
    try {
      await this.assetStorage.moveObject(backupPath, this.imagePath(topicId, kindOf(backupPath)));
    } catch {
      // Best effort rollback.
    }
  }

  async finishClear(backupPath: string | null) {
    if (!backupPath) return;
    await this.assetStorage.deleteObject(backupPath);
  }

  async discardTemp(tempPath: string | null) {
    if (!tempPath) return;
    await this.assetStorage.deleteObject(tempPath);
  }

  async getImage(topicId: UUID) {
    const current = await this.findImage(topicId);
    if (!current) {
      throw new NotFoundException("本周灵感专题封面图不存在");
    }

    return {
      contentType: getType(current.kind),
      stream: current.asset.stream,
      stat: { size: current.asset.size }
    };
  }

  private imageDir() {
    return assetKey("uploads", "home-topics");
  }

  private tempDir() {
    return assetKey(this.imageDir(), ".tmp");
  }

  private imagePath(topicId: UUID, kind: ImageKind) {
    return assetKey(this.imageDir(), `${topicId}.${getExt(kind)}`);
  }

  private backupPath(topicId: UUID, kind: ImageKind) {
    return assetKey(this.tempDir(), `${topicId}-backup.${getExt(kind)}`);
  }

  private tempKey(kind: ImageKind) {
    return assetKey(this.tempDir(), `${randomUUID()}.${getExt(kind)}`);
  }

  private async clearImage(topicId: UUID) {
    const keys = await this.assetStorage.listObjects(this.imageDir());
    await Promise.all(keys.filter(name => new RegExp(`/${topicId}\\.(jpg|png|webp)$`, "i").test(name)).map(key => this.assetStorage.deleteObject(key)));
  }

  private async findImage(topicId: UUID) {
    const keys = await this.assetStorage.listObjects(this.imageDir());
    const match = keys.find(name => new RegExp(`/${topicId}\\.(jpg|png|webp)$`, "i").test(name));
    if (!match) return null;
    const lower = match.toLowerCase();
    const kind: ImageKind = lower.endsWith(".png") ? "png" : lower.endsWith(".webp") ? "webp" : "jpeg";
    const asset = await this.assetStorage.readObject(match, getType(kind)).catch(() => null);
    return asset ? { kind, path: match, asset } : null;
  }
}
