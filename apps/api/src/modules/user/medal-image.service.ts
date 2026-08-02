import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { UUID } from "../../contracts/types";

type ImageKind = "jpeg" | "png" | "webp" | "svg";
export type MedalImageType = "earned" | "locked";
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const maxImageBytes = 5 * 1024 * 1024;

function getAssetRoot() {
  return resolve(process.env.APP_ASSET_DIR || join(process.cwd(), "var", "app-assets"));
}

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

function getKindFromPath(path: string): ImageKind {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith(".png")) return "png";
  if (lowerPath.endsWith(".webp")) return "webp";
  if (lowerPath.endsWith(".svg")) return "svg";
  return "jpeg";
}

@Injectable()
export class MedalImageService {
  buildImageUrl(request: RequestLike, templateId: UUID, imageType: MedalImageType, updatedAt: Date | null) {
    if (!updatedAt) return null;
    const protocol = request.protocol || "http";
    const host = request.get?.("host");
    const path = `/api/public-assets/medals/${templateId}/${imageType}?v=${encodeURIComponent(updatedAt.toISOString())}`;
    if (!host) return path;
    return `${protocol}://${host}${path}`;
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
    await mkdir(this.getTempDir(), { recursive: true });
    await writeFile(tempPath, file.buffer);
    return {
      tempPath,
      kind
    };
  }

  async replaceStagedImage(templateId: UUID, imageType: MedalImageType, tempPath: string, kind: ImageKind) {
    const current = await this.findStoredImage(templateId, imageType);
    const nextPath = this.getImagePath(templateId, imageType, kind);
    const backupPath = current ? this.getBackupPath(templateId, imageType, current.kind) : null;

    await mkdir(this.getImageDir(), { recursive: true });
    await mkdir(this.getTempDir(), { recursive: true });
    if (backupPath) {
      await rm(backupPath, { force: true });
    }

    if (current) {
      try {
        await rename(current.path, backupPath as string);
      } catch {
        // Best effort backup. If the current file disappears unexpectedly, we still try to replace it.
      }
    }

    try {
      await this.clearStoredImage(templateId, imageType);
      await rename(tempPath, nextPath);
    } catch (error) {
      if (backupPath) {
        try {
          await rename(backupPath, current?.path ?? this.getImagePath(templateId, imageType, kind));
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
      await rename(backupPath, this.getImagePath(templateId, imageType, getKindFromPath(backupPath)));
    } catch {
      // Best effort rollback.
    }
  }

  async finalizeReplacedImage(backupPath: string | null) {
    if (!backupPath) return;
    await rm(backupPath, { force: true });
  }

  async stageClearImage(templateId: UUID, imageType: MedalImageType) {
    const current = await this.findStoredImage(templateId, imageType);
    if (!current) return null;
    const backupPath = this.getBackupPath(templateId, imageType, current.kind);
    await mkdir(this.getTempDir(), { recursive: true });
    await rm(backupPath, { force: true });
    try {
      await rename(current.path, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  async rollbackClearedImage(templateId: UUID, backupPath: string | null) {
    if (!backupPath) return;
    const imageType = backupPath.includes("-locked-") ? "locked" : "earned";
    try {
      await rename(backupPath, this.getImagePath(templateId, imageType, getKindFromPath(backupPath)));
    } catch {
      // Best effort rollback.
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

  async getImageAsset(templateId: UUID, imageType: MedalImageType) {
    const current = await this.findStoredImage(templateId, imageType);
    if (!current) {
      throw new NotFoundException("勋章图片不存在");
    }

    try {
      return {
        contentType: getContentType(current.kind),
        stream: createReadStream(current.path),
        stat: await stat(current.path)
      };
    } catch {
      throw new NotFoundException("勋章图片不存在");
    }
  }

  private async findStoredImage(templateId: UUID, imageType: MedalImageType) {
    for (const kind of ["png", "jpeg", "webp", "svg"] as const) {
      const path = this.getImagePath(templateId, imageType, kind);
      try {
        await stat(path);
        return { kind, path };
      } catch {
        continue;
      }
    }
    if (imageType === "earned") {
      for (const kind of ["png", "jpeg", "webp", "svg"] as const) {
        const path = this.getLegacyImagePath(templateId, kind);
        try {
          await stat(path);
          return { kind, path };
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  private async clearStoredImage(templateId: UUID, imageType: MedalImageType) {
    const targets = [
      rm(this.getImagePath(templateId, imageType, "png"), { force: true }),
      rm(this.getImagePath(templateId, imageType, "jpeg"), { force: true }),
      rm(this.getImagePath(templateId, imageType, "webp"), { force: true }),
      rm(this.getImagePath(templateId, imageType, "svg"), { force: true })
    ];
    if (imageType === "earned") {
      targets.push(
        rm(this.getLegacyImagePath(templateId, "png"), { force: true }),
        rm(this.getLegacyImagePath(templateId, "jpeg"), { force: true }),
        rm(this.getLegacyImagePath(templateId, "webp"), { force: true }),
        rm(this.getLegacyImagePath(templateId, "svg"), { force: true })
      );
    }
    await Promise.all(targets);
  }

  private getImageDir() {
    return join(getAssetRoot(), "medals");
  }

  private getImagePath(templateId: UUID, imageType: MedalImageType, kind: ImageKind) {
    return join(this.getImageDir(), `${templateId}-${imageType}.${getExtension(kind)}`);
  }

  private getLegacyImagePath(templateId: UUID, kind: ImageKind) {
    return join(this.getImageDir(), `${templateId}.${getExtension(kind)}`);
  }

  private getTempDir() {
    return join(getAssetRoot(), "medals-temp");
  }

  private getTempPath(templateId: UUID, imageType: MedalImageType, kind: ImageKind) {
    return join(this.getTempDir(), `${templateId}-${imageType}-${randomUUID()}.${getExtension(kind)}`);
  }

  private getBackupPath(templateId: UUID, imageType: MedalImageType, kind: ImageKind) {
    return join(this.getTempDir(), `${templateId}-${imageType}-${randomUUID()}.bak.${getExtension(kind)}`);
  }
}
