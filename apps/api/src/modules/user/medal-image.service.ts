import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { assetKey, AssetStorageService } from "../../common/asset-storage.service";
import type { UUID } from "../../contracts/types";

type ImageKind = "jpeg" | "png" | "webp" | "svg";
export type MedalImageType = "earned" | "locked";
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

  const text = buffer.toString("utf8").replace(/^\uFEFF/, "").trimStart();
  if (/^(<\?xml[\s\S]*?\?>\s*)?<svg[\s>]/i.test(text)) {
    return "svg";
  }

  return null;
}

function hasUnsafeSvgContent(buffer: Buffer) {
  const text = buffer.toString("utf8");
  return /<script[\s>]/i.test(text)
    || /<foreignObject[\s>]/i.test(text)
    || /<(iframe|object|embed|image)\b/i.test(text)
    || /\son[a-z]+\s*=/i.test(text)
    || /javascript:/i.test(text);
}

function getContentType(kind: ImageKind) {
  if (kind === "jpeg") return "image/jpeg";
  if (kind === "png") return "image/png";
  if (kind === "svg") return "image/svg+xml";
  return "image/webp";
}

function getExtension(kind: ImageKind) {
  if (kind === "jpeg") return "jpg";
  if (kind === "png") return "png";
  if (kind === "svg") return "svg";
  return "webp";
}

function getKindFromPath(storageKey: string): ImageKind {
  const lowerPath = storageKey.toLowerCase();
  if (lowerPath.endsWith(".png")) return "png";
  if (lowerPath.endsWith(".webp")) return "webp";
  if (lowerPath.endsWith(".svg")) return "svg";
  return "jpeg";
}

@Injectable()
export class MedalImageService {
  constructor(@Inject(AssetStorageService) private readonly assetStorage: AssetStorageService) {}

  buildImageUrl(request: RequestLike, templateId: UUID, imageType: MedalImageType, updatedAt: Date | null) {
    if (!updatedAt) return null;
    return this.assetStorage.publicUrl(request, this.getPublicKey(templateId, imageType), updatedAt);
  }

  async stageImageUpload(templateId: UUID, imageType: MedalImageType, file: { buffer?: Buffer; size?: number } | undefined) {
    if (!file?.buffer || typeof file.size !== "number") {
      throw new BadRequestException("请上传勋章图片");
    }
    if (file.size <= 0 || file.size > maxImageBytes) {
      throw new BadRequestException("图片大小不能超过 5 MB");
    }

    const kind = detectImageKind(file.buffer);
    if (!kind) {
      throw new BadRequestException("仅支持 JPG、PNG、WEBP、SVG 图片");
    }
    if (kind === "svg" && hasUnsafeSvgContent(file.buffer)) {
      throw new BadRequestException("SVG 含不安全内容，请移除脚本、事件或外部资源引用");
    }

    const tempPath = this.getTempPath(templateId, imageType, kind);
    await this.assetStorage.writeObject(tempPath, file.buffer, getContentType(kind));
    return {
      tempPath,
      kind
    };
  }

  async replaceStagedImage(templateId: UUID, imageType: MedalImageType, tempPath: string, kind: ImageKind) {
    const current = await this.findStoredImage(templateId, imageType);
    const nextPath = this.getImagePath(templateId, imageType, kind);
    const backupPath = current ? this.getBackupPath(templateId, imageType, current.kind) : null;

    if (backupPath) {
      await this.assetStorage.deleteObject(backupPath);
    }

    if (current) {
      try {
        await this.assetStorage.moveObject(current.path, backupPath as string);
      } catch {
        // Best effort backup. If the current file disappears unexpectedly, we still try to replace it.
      }
    }

    try {
      await this.clearStoredImage(templateId, imageType);
      await this.assetStorage.moveObject(tempPath, nextPath);
    } catch (error) {
      if (backupPath) {
        try {
          await this.assetStorage.moveObject(backupPath, current?.path ?? this.getImagePath(templateId, imageType, kind));
        } catch {
          // Best effort rollback. Upper layer still surfaces the error.
        }
      }
      throw error;
    }

    return backupPath;
  }

  async rollbackReplacedImage(templateId: UUID, imageType: MedalImageType, backupPath: string | null) {
    await this.clearStoredImage(templateId, imageType);
    if (!backupPath) return;
    try {
      await this.assetStorage.moveObject(backupPath, this.getImagePath(templateId, imageType, getKindFromPath(backupPath)));
    } catch {
      // Best effort rollback.
    }
  }

  async finalizeReplacedImage(backupPath: string | null) {
    if (!backupPath) return;
    await this.assetStorage.deleteObject(backupPath);
  }

  async stageClearImage(templateId: UUID, imageType: MedalImageType) {
    const current = await this.findStoredImage(templateId, imageType);
    if (!current) return null;
    const backupPath = this.getBackupPath(templateId, imageType, current.kind);
    await this.assetStorage.deleteObject(backupPath);
    try {
      await this.assetStorage.moveObject(current.path, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  async rollbackClearedImage(templateId: UUID, backupPath: string | null) {
    if (!backupPath) return;
    const imageType = backupPath.includes("-locked-") ? "locked" : "earned";
    try {
      await this.assetStorage.moveObject(backupPath, this.getImagePath(templateId, imageType, getKindFromPath(backupPath)));
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

  async getImageAsset(templateId: UUID, imageType: MedalImageType) {
    const current = await this.findStoredImage(templateId, imageType);
    if (!current) {
      throw new NotFoundException("勋章图片不存在");
    }

    return {
      contentType: getContentType(current.kind),
      stream: current.asset.stream,
      stat: { size: current.asset.size }
    };
  }

  private async findStoredImage(templateId: UUID, imageType: MedalImageType) {
    for (const kind of ["png", "jpeg", "webp", "svg"] as const) {
      const path = this.getImagePath(templateId, imageType, kind);
      const asset = await this.assetStorage.readObject(path, getContentType(kind)).catch(() => null);
      if (asset) return { kind, path, asset };
    }
    if (imageType === "earned") {
      for (const kind of ["png", "jpeg", "webp", "svg"] as const) {
        const path = this.getLegacyImagePath(templateId, kind);
        const asset = await this.assetStorage.readObject(path, getContentType(kind)).catch(() => null);
        if (asset) return { kind, path, asset };
      }
    }
    return null;
  }

  private async clearStoredImage(templateId: UUID, imageType: MedalImageType) {
    const targets = [
      this.assetStorage.deleteObject(this.getImagePath(templateId, imageType, "png")),
      this.assetStorage.deleteObject(this.getImagePath(templateId, imageType, "jpeg")),
      this.assetStorage.deleteObject(this.getImagePath(templateId, imageType, "webp")),
      this.assetStorage.deleteObject(this.getImagePath(templateId, imageType, "svg"))
    ];
    if (imageType === "earned") {
      targets.push(
        this.assetStorage.deleteObject(this.getLegacyImagePath(templateId, "png")),
        this.assetStorage.deleteObject(this.getLegacyImagePath(templateId, "jpeg")),
        this.assetStorage.deleteObject(this.getLegacyImagePath(templateId, "webp")),
        this.assetStorage.deleteObject(this.getLegacyImagePath(templateId, "svg"))
      );
    }
    await Promise.all(targets);
  }

  private getImageDir() {
    return assetKey("uploads", "medals");
  }

  private getPublicKey(templateId: UUID, imageType: MedalImageType) {
    return imageType === "earned" ? assetKey(this.getImageDir(), templateId) : assetKey(this.getImageDir(), templateId, imageType);
  }

  private getImagePath(templateId: UUID, imageType: MedalImageType, kind: ImageKind) {
    return assetKey(this.getImageDir(), `${templateId}-${imageType}.${getExtension(kind)}`);
  }

  private getLegacyImagePath(templateId: UUID, kind: ImageKind) {
    return assetKey(this.getImageDir(), `${templateId}.${getExtension(kind)}`);
  }

  private getTempDir() {
    return assetKey(this.getImageDir(), ".tmp");
  }

  private getTempPath(templateId: UUID, imageType: MedalImageType, kind: ImageKind) {
    return assetKey(this.getTempDir(), `${templateId}-${imageType}-${randomUUID()}.${getExtension(kind)}`);
  }

  private getBackupPath(templateId: UUID, imageType: MedalImageType, kind: ImageKind) {
    return assetKey(this.getTempDir(), `${templateId}-${imageType}-${randomUUID()}.bak.${getExtension(kind)}`);
  }
}
