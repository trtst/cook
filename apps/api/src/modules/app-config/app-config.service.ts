import { createHash } from "node:crypto";
import { Inject, BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { assetKey, AssetStorageService } from "../../common/asset-storage.service";
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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssetStorageService) private readonly assetStorage: AssetStorageService
  ) {}

  async getPublicConfig(request: RequestLike): Promise<AppConfigResponse> {
    const loginImage = await this.findStoredLoginImage();
    return {
      login: {
        imageUrl: loginImage ? this.buildLoginImageUrl(request, loginImage.storageKey) : null
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

      await this.clearStoredLoginImage();
      await this.assetStorage.writeObject(this.getLoginImageKey(kind), buffer, getContentType(kind));

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

  async getLoginImageAsset(fileName?: string) {
    const file = await this.readStoredLoginImage(fileName);

    return {
      contentType: getContentType(file.kind),
      stream: file.asset.stream,
      stat: { size: file.asset.size }
    };
  }

  private getLoginImagePrefix() {
    return assetKey("uploads", "admin", "login-image");
  }

  private getLoginImageKey(kind: ImageKind) {
    return assetKey(this.getLoginImagePrefix(), `${loginImageBaseName}.${getExtension(kind)}`);
  }

  private async clearStoredLoginImage() {
    const keys = await this.assetStorage.listObjects(this.getLoginImagePrefix());
    await Promise.all(keys.filter(key => /\/login-image\.(jpg|png|webp)$/i.test(key)).map(key => this.assetStorage.deleteObject(key)));
  }

  private async findStoredLoginImage() {
    const keys = await this.assetStorage.listObjects(this.getLoginImagePrefix());
    const match = keys.find(key => /\/login-image\.(jpg|png|webp)$/i.test(key));
    if (!match) return null;
    const lowerName = match.toLowerCase();
    const kind: ImageKind = lowerName.endsWith(".png") ? "png" : lowerName.endsWith(".webp") ? "webp" : "jpeg";
    return { kind, storageKey: match };
  }

  private async readStoredLoginImage(fileName?: string) {
    const file = await this.findStoredLoginImage();
    if (!file) {
      throw new NotFoundException("登录图片不存在");
    }
    if (fileName && !file.storageKey.endsWith(`/${fileName}`)) {
      throw new NotFoundException("登录图片不存在");
    }
    const asset = await this.assetStorage.readObject(file.storageKey, getContentType(file.kind)).catch(() => null);
    if (!asset) {
      throw new NotFoundException("登录图片不存在");
    }
    return { ...file, asset };
  }

  private buildLoginImageUrl(request: RequestLike, storageKey: string) {
    return this.assetStorage.publicUrl(request, storageKey, null);
  }
}
