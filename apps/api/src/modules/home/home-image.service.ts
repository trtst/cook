import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { HomeFeatureBoardPlacement } from "@prisma/client";

type ImageKind = "jpeg" | "png" | "webp";

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
  buildImagePath(placement: HomeFeatureBoardPlacement) {
    return `/api/public-assets/home-entries/${placement}`;
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

    await mkdir(this.getTempDir(), { recursive: true });
    const tempPath = join(this.getTempDir(), `${placement}-${randomUUID()}.${getExtension(kind)}`);
    await writeFile(tempPath, file.buffer);
    return {
      tempPath,
      kind
    };
  }

  async replaceStagedImage(placement: HomeFeatureBoardPlacement, tempPath: string, kind: ImageKind) {
    const current = await this.findStoredImage(placement);
    const nextPath = this.getImagePath(placement, kind);
    const backupPath = current ? this.getBackupPath(placement, current.kind) : null;

    await mkdir(this.getImageDir(), { recursive: true });
    await mkdir(this.getTempDir(), { recursive: true });
    if (backupPath) {
      await rm(backupPath, { force: true });
    }

    if (current) {
      try {
        await rename(current.path, backupPath as string);
      } catch {
        // Best effort backup.
      }
    }

    try {
      await this.clearStoredImage(placement);
      await rename(tempPath, nextPath);
    } catch (error) {
      if (backupPath) {
        try {
          await rename(backupPath, current?.path ?? this.getImagePath(placement, kind));
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
      await rename(backupPath, this.getImagePath(placement, getKindFromPath(backupPath)));
    } catch {
      // Best effort rollback.
    }
  }

  async finalizeReplacedImage(backupPath: string | null) {
    if (!backupPath) return;
    await rm(backupPath, { force: true });
  }

  async stageClearImage(placement: HomeFeatureBoardPlacement) {
    const current = await this.findStoredImage(placement);
    if (!current) return null;
    const backupPath = this.getBackupPath(placement, current.kind);
    await mkdir(this.getTempDir(), { recursive: true });
    await rm(backupPath, { force: true });
    try {
      await rename(current.path, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  async rollbackClearedImage(placement: HomeFeatureBoardPlacement, backupPath: string | null) {
    if (!backupPath) return;
    try {
      await rename(backupPath, this.getImagePath(placement, getKindFromPath(backupPath)));
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

  async getImageAsset(placement: HomeFeatureBoardPlacement) {
    const current = await this.findStoredImage(placement);
    if (!current) {
      throw new NotFoundException("首页快捷入口图片不存在");
    }

    return {
      contentType: getContentType(current.kind),
      stream: createReadStream(current.path),
      stat: await stat(current.path)
    };
  }

  private getImageDir() {
    return join(getAssetRoot(), "home-entries");
  }

  private getTempDir() {
    return join(this.getImageDir(), ".tmp");
  }

  private getImagePath(placement: HomeFeatureBoardPlacement, kind: ImageKind) {
    return join(this.getImageDir(), `${placement}.${getExtension(kind)}`);
  }

  private getBackupPath(placement: HomeFeatureBoardPlacement, kind: ImageKind) {
    return join(this.getTempDir(), `${placement}-backup.${getExtension(kind)}`);
  }

  private async clearStoredImage(placement: HomeFeatureBoardPlacement) {
    try {
      const files = await readdir(this.getImageDir());
      await Promise.all(
        files
          .filter(name => name.startsWith(`${placement}.`))
          .map(name => rm(join(this.getImageDir(), name), { force: true }))
      );
    } catch {
      return;
    }
  }

  private async findStoredImage(placement: HomeFeatureBoardPlacement) {
    try {
      const files = await readdir(this.getImageDir());
      const match = files.find(name => new RegExp(`^${placement}\\.(jpg|png|webp)$`, "i").test(name));
      if (!match) return null;
      const lowerName = match.toLowerCase();
      const kind: ImageKind = lowerName.endsWith(".png") ? "png" : lowerName.endsWith(".webp") ? "webp" : "jpeg";
      return {
        kind,
        path: join(this.getImageDir(), match)
      };
    } catch {
      return null;
    }
  }
}
