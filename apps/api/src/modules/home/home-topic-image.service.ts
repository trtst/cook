import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { UUID } from "../../contracts/types";

type ImageKind = "jpeg" | "png" | "webp";

const maxImageBytes = 5 * 1024 * 1024;

function getAssetRoot() {
  return resolve(process.env.APP_ASSET_DIR || join(process.cwd(), "var", "app-assets"));
}

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
  buildImagePath(topicId: UUID) {
    return `/api/public-assets/home-topics/${topicId}`;
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

    await mkdir(this.tempDir(), { recursive: true });
    const tempPath = join(this.tempDir(), `${randomUUID()}.${getExt(kind)}`);
    await writeFile(tempPath, file.buffer);
    return { tempPath, kind };
  }

  async replaceImage(topicId: UUID, tempPath: string, kind: ImageKind) {
    const current = await this.findImage(topicId);
    const nextPath = this.imagePath(topicId, kind);
    const backupPath = current ? this.backupPath(topicId, current.kind) : null;

    await mkdir(this.imageDir(), { recursive: true });
    await mkdir(this.tempDir(), { recursive: true });
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
      await this.clearImage(topicId);
      await rename(tempPath, nextPath);
    } catch (error) {
      if (backupPath) {
        try {
          await rename(backupPath, current?.path ?? this.imagePath(topicId, kind));
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
      await rename(backupPath, this.imagePath(topicId, kindOf(backupPath)));
    } catch {
      // Best effort rollback.
    }
  }

  async finishReplace(backupPath: string | null) {
    if (!backupPath) return;
    await rm(backupPath, { force: true });
  }

  async stageClear(topicId: UUID) {
    const current = await this.findImage(topicId);
    if (!current) return null;
    const backupPath = this.backupPath(topicId, current.kind);
    await mkdir(this.tempDir(), { recursive: true });
    await rm(backupPath, { force: true });
    try {
      await rename(current.path, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  async rollbackClear(topicId: UUID, backupPath: string | null) {
    if (!backupPath) return;
    try {
      await rename(backupPath, this.imagePath(topicId, kindOf(backupPath)));
    } catch {
      // Best effort rollback.
    }
  }

  async finishClear(backupPath: string | null) {
    if (!backupPath) return;
    await rm(backupPath, { force: true });
  }

  async discardTemp(tempPath: string | null) {
    if (!tempPath) return;
    await rm(tempPath, { force: true });
  }

  async getImage(topicId: UUID) {
    const current = await this.findImage(topicId);
    if (!current) {
      throw new NotFoundException("本周灵感专题封面图不存在");
    }

    return {
      contentType: getType(current.kind),
      stream: createReadStream(current.path),
      stat: await stat(current.path)
    };
  }

  private imageDir() {
    return join(getAssetRoot(), "home-topics");
  }

  private tempDir() {
    return join(this.imageDir(), ".tmp");
  }

  private imagePath(topicId: UUID, kind: ImageKind) {
    return join(this.imageDir(), `${topicId}.${getExt(kind)}`);
  }

  private backupPath(topicId: UUID, kind: ImageKind) {
    return join(this.tempDir(), `${topicId}-backup.${getExt(kind)}`);
  }

  private async clearImage(topicId: UUID) {
    try {
      const files = await readdir(this.imageDir());
      await Promise.all(
        files
          .filter(name => name.startsWith(`${topicId}.`))
          .map(name => rm(join(this.imageDir(), name), { force: true }))
      );
    } catch {
      return;
    }
  }

  private async findImage(topicId: UUID) {
    try {
      const files = await readdir(this.imageDir());
      const match = files.find(name => new RegExp(`^${topicId}\\.(jpg|png|webp)$`, "i").test(name));
      if (!match) return null;
      const lower = match.toLowerCase();
      const kind: ImageKind = lower.endsWith(".png") ? "png" : lower.endsWith(".webp") ? "webp" : "jpeg";
      return {
        kind,
        path: join(this.imageDir(), match)
      };
    } catch {
      return null;
    }
  }
}
