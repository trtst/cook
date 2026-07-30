import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { Inject, BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
import { PrismaService } from "../../common/prisma.service";
import type { AppConfigResponse, OperationId, UUID } from "../../contracts/types";

type ImageKind = "jpeg" | "png" | "webp";
type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
};

const loginImageBaseName = "login-image";
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

@Injectable()
export class AppConfigService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPublicConfig(request: RequestLike): Promise<AppConfigResponse> {
    return {
      login: {
        imageUrl: (await this.hasLoginImage()) ? this.buildLoginImageUrl(request) : null
      }
    };
  }

  async saveLoginImage(
    request: RequestLike,
    adminId: UUID,
    operationId: OperationId,
    file: { buffer?: Buffer; size?: number } | undefined
  ): Promise<AppConfigResponse> {
    if (!file?.buffer || typeof file.size !== "number") {
      throw new BadRequestException("请上传登录图片");
    }
    const buffer = file.buffer;

    if (file.size <= 0 || file.size > maxImageBytes) {
      throw new BadRequestException("图片大小不能超过 5 MB");
    }

    const kind = detectImageKind(buffer);
    if (!kind) {
      throw new BadRequestException("仅支持 JPG、PNG、WEBP 图片");
    }

    const requestHash = createHash("sha256")
      .update(kind)
      .update(":")
      .update(String(file.size))
      .update(":")
      .update(buffer)
      .digest("hex");

    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AppConfigResponse>(
        tx,
        operationId,
        "admin-app-config:login-image:save",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-app-config:login-image:save", adminId, requestHash);

      await mkdir(this.getLoginImageDir(), { recursive: true });
      await this.clearStoredLoginImage();
      await writeFile(this.getLoginImagePath(kind), buffer);

      const result = await this.getPublicConfig(request);
      await completeAdminIdempotentOperation(tx, operationId, "admin-app-config:login-image:save", adminId, requestHash, result);
      return result;
    });
  }

  async clearLoginImage(request: RequestLike, adminId: UUID, operationId: OperationId): Promise<AppConfigResponse> {
    const requestHash = "clear";
    return this.prisma.$transaction(async tx => {
      const repeated = await getAdminIdempotentResult<AppConfigResponse>(
        tx,
        operationId,
        "admin-app-config:login-image:clear",
        adminId,
        requestHash
      );
      if (repeated) return repeated;
      await startAdminIdempotentOperation(tx, operationId, "admin-app-config:login-image:clear", adminId, requestHash);

      await this.clearStoredLoginImage();

      const result = await this.getPublicConfig(request);
      await completeAdminIdempotentOperation(tx, operationId, "admin-app-config:login-image:clear", adminId, requestHash, result);
      return result;
    });
  }

  async getLoginImageAsset() {
    const file = await this.findStoredLoginImage();
    if (!file) {
      throw new NotFoundException("登录图片不存在");
    }

    return {
      contentType: getContentType(file.kind),
      stream: createReadStream(file.path),
      stat: await stat(file.path)
    };
  }

  private getLoginImageDir() {
    return join(getAssetRoot(), "login");
  }

  private getLoginImagePath(kind: ImageKind) {
    return join(this.getLoginImageDir(), `${loginImageBaseName}.${getExtension(kind)}`);
  }

  private async hasLoginImage() {
    return Boolean(await this.findStoredLoginImage());
  }

  private async clearStoredLoginImage() {
    try {
      const files = await readdir(this.getLoginImageDir());
      await Promise.all(
        files
          .filter((name) => name.startsWith(`${loginImageBaseName}.`))
          .map((name) => rm(join(this.getLoginImageDir(), name), { force: true }))
      );
    } catch {
      return;
    }
  }

  private async findStoredLoginImage() {
    try {
      const files = await readdir(this.getLoginImageDir());
      const match = files.find((name) => /^login-image\.(jpg|png|webp)$/i.test(name));
      if (!match) return null;

      const lowerName = match.toLowerCase();
      const kind: ImageKind = lowerName.endsWith(".png") ? "png" : lowerName.endsWith(".webp") ? "webp" : "jpeg";

      return {
        kind,
        path: join(this.getLoginImageDir(), match)
      };
    } catch {
      return null;
    }
  }

  private buildLoginImageUrl(request: RequestLike) {
    const protocol = request.protocol || "http";
    const host = request.get?.("host");
    if (!host) return "/api/public-assets/login-image";
    return `${protocol}://${host}/api/public-assets/login-image`;
  }
}
