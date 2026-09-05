import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { HomeFeatureBoardPlacement } from "@prisma/client";
import { assetKey, AssetStorageService } from "../../common/asset-storage.service";

type ImageKind = "jpeg" | "png" | "webp";
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const maxImageBytes = 5 * 1024 * 1024;

function detectImageKind(buffer: Buffer): ImageKind | null {
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

function getContentType(kind: ImageKind) {
  if (kind === "jpeg") return "image/jpeg";
  if (kind === "png") return "image/png";
  return "image/webp";
}

function getExtension(kind: ImageKind) {
  if (kind === "jpeg") return "jpg";
  if (kind === "png") return "png";
  return "webp";
}

function getKindFromPath(path: string): ImageKind {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith(".png")) return "png";
  if (lowerPath.endsWith(".webp")) return "webp";
  return "jpeg";
}

@Injectable()
export class HomeImageService {
  constructor(@Inject(AssetStorageService) private readonly assetStorage: AssetStorageService) {}

  buildImagePath(request: RequestLike, placement: HomeFeatureBoardPlacement) {
    return this.assetStorage.publicUrl(request, this.getPublicKey(placement));
  }

  async stageImageUpload(placement: HomeFeatureBoardPlacement, file: { buffer?: Buffer; size?: number } | undefined) {
    if (!file?.buffer || typeof file.size !== "number") {
      throw new BadRequestException("请上传首页快捷入口图片");
    }
    if (file.size <= 0 || file.size > maxImageBytes) {
      throw new BadRequestException("图片大小不能超过 5 MB");
    }

    const kind = detectImageKind(file.buffer);
    if (!kind) {
      throw new BadRequestException("仅支持 JPG、PNG、WEBP 图片");
    }

    const tempPath = this.getTempKey(placement, kind);
    await this.assetStorage.writeObject(tempPath, file.buffer, getContentType(kind));
    return {
      tempPath,
      kind
    };
  }

  async replaceStagedImage(placement: HomeFeatureBoardPlacement, tempPath: string, kind: ImageKind) {
    const current = await this.findStoredImage(placement);
    const nextPath = this.getImageKey(placement, kind);
    const backupPath = current ? this.getBackupPath(placement, current.kind) : null;
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
      await this.clearStoredImage(placement);
      await this.assetStorage.moveObject(tempPath, nextPath);
    } catch (error) {
      if (backupPath) {
        try {
          await this.assetStorage.moveObject(backupPath, current?.path ?? this.getImageKey(placement, kind));
        } catch {
          // Best effort rollback.
        }
      }
      throw error;
    }

    return backupPath;
  }

  async rollbackReplacedImage(placement: HomeFeatureBoardPlacement, backupPath: string | null) {
    await this.clearStoredImage(placement);
    if (!backupPath) return;
    try {
      await this.assetStorage.moveObject(backupPath, this.getImageKey(placement, getKindFromPath(backupPath)));
    } catch {
      // Best effort rollback.
    }
  }

  async finalizeReplacedImage(backupPath: string | null) {
    if (!backupPath) return;
    await this.assetStorage.deleteObject(backupPath);
  }

  async stageClearImage(placement: HomeFeatureBoardPlacement) {
    const current = await this.findStoredImage(placement);
    if (!current) return null;
    const backupPath = this.getBackupPath(placement, current.kind);
    await this.assetStorage.deleteObject(backupPath);
    try {
      await this.assetStorage.moveObject(current.path, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  async rollbackClearedImage(placement: HomeFeatureBoardPlacement, backupPath: string | null) {
    if (!backupPath) return;
    try {
      await this.assetStorage.moveObject(backupPath, this.getImageKey(placement, getKindFromPath(backupPath)));
    } catch {
      // Best effort rollback.
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

  async getImageAsset(placement: HomeFeatureBoardPlacement) {
    const current = await this.findStoredImage(placement);
    if (!current) {
      throw new NotFoundException("首页快捷入口图片不存在");
    }

    return {
      contentType: getContentType(current.kind),
      stream: current.asset.stream,
      stat: { size: current.asset.size }
    };
  }

  private getImagePrefix() {
    return assetKey("uploads", "home-entries");
  }

  private getPublicKey(placement: HomeFeatureBoardPlacement) {
    return assetKey(this.getImagePrefix(), placement);
  }

  private getImageKey(placement: HomeFeatureBoardPlacement, kind: ImageKind) {
    return assetKey(this.getImagePrefix(), `${placement}.${getExtension(kind)}`);
  }

  private getBackupPath(placement: HomeFeatureBoardPlacement, kind: ImageKind) {
    return assetKey(this.getImagePrefix(), ".tmp", `${placement}-backup.${getExtension(kind)}`);
  }

  private getTempKey(placement: HomeFeatureBoardPlacement, kind: ImageKind) {
    return assetKey(this.getImagePrefix(), ".tmp", `${placement}-${randomUUID()}.${getExtension(kind)}`);
  }

  private async clearStoredImage(placement: HomeFeatureBoardPlacement) {
    const keys = await this.assetStorage.listObjects(this.getImagePrefix());
    await Promise.all(keys.filter(name => new RegExp(`/${placement}\\.(jpg|png|webp)$`, "i").test(name)).map(key => this.assetStorage.deleteObject(key)));
  }

  private async findStoredImage(placement: HomeFeatureBoardPlacement) {
    const keys = await this.assetStorage.listObjects(this.getImagePrefix());
    const match = keys.find(name => new RegExp(`/${placement}\\.(jpg|png|webp)$`, "i").test(name));
    if (!match) return null;
    const lowerName = match.toLowerCase();
    const kind: ImageKind = lowerName.endsWith(".png") ? "png" : lowerName.endsWith(".webp") ? "webp" : "jpeg";
    const asset = await this.assetStorage.readObject(match, getContentType(kind)).catch(() => null);
    return asset ? { kind, path: match, asset } : null;
  }
}
