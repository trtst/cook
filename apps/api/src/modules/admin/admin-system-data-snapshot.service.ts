import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { completeAdminIdempotentOperation, getAdminIdempotentResult, startAdminIdempotentOperation } from "../../common/idempotency";
import { AssetStorageService, assetKey } from "../../common/asset-storage.service";
import { PrismaService } from "../../common/prisma.service";
import {
  collectCategoryRows,
  mergeSnapshotRows,
  snapshotCategoryLabels,
  snapshotCategoryOfModel,
  snapshotCategories,
  snapshotModels,
  snapshotModelWhere,
  snapshotVersion,
  validateSnapshotDocument,
  type SnapshotCategory,
  type SnapshotDocument,
  type SnapshotRows
} from "./system-data-snapshot";

const AdmZip = require("adm-zip") as new (buffer?: Buffer) => {
  addFile(name: string, data: Buffer): void;
  getEntries(): Array<{ entryName: string; isDirectory: boolean; header: { size: number }; getData(): Buffer }>;
  readAsText(name: string): string;
  toBuffer(): Buffer;
};

const maxArchiveEntries = 20_000;
const maxArchiveBytes = 200 * 1024 * 1024;
const maxExpandedBytes = 1024 * 1024 * 1024;
const maxExpandedEntryBytes = 200 * 1024 * 1024;
const maxRecords = 200_000;
type DataEnvironment = "TEST" | "ONLINE";
type SnapshotAsset = SnapshotDocument["assets"][number] & { sourceKey: string; references: string[] };
type SnapshotArchive = { document: SnapshotDocument; files: Map<string, Buffer> };

type ModelField = { name: string; kind: string; type: string; isUnique?: boolean; isRequired?: boolean; relationFromFields: string[]; relationToFields: string[]; relationOnDelete?: string };
type ModelInfo = { name: string; dbName: string | null; fields: ModelField[]; primaryKey?: { fields: string[]; name?: string } | null; uniqueFields?: string[][] };
type DynamicDelegate = {
  findMany(args?: unknown): Promise<Array<Record<string, unknown>>>;
  deleteMany(args?: unknown): Promise<{ count: number }>;
  upsert(args: unknown): Promise<unknown>;
  count(args?: unknown): Promise<number>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function modelInfo(name: string): ModelInfo {
  const model = Prisma.dmmf.datamodel.models.find(item => item.name === name);
  if (!model) throw new Error(`未知的快照模型：${name}`);
  return model as unknown as ModelInfo;
}

function modelDelegate(db: object, modelName: string) {
  const name = modelName[0].toLowerCase() + modelName.slice(1);
  const delegate = (db as Record<string, unknown>)[name] as DynamicDelegate | undefined;
  if (!delegate) throw new Error(`快照模型未注册：${modelName}`);
  return delegate;
}

function primaryFields(model: string) {
  const info = modelInfo(model);
  return info.primaryKey?.fields ?? info.fields.filter(field => (field as unknown as { isId?: boolean }).isId).map(field => field.name);
}

function partialUniqueIndexes(model: string) {
  if (model === "Unit") return [
    { fields: ["searchKey"], applies: (row: Record<string, unknown>) => row.ownerId == null },
    { fields: ["ownerId", "searchKey"], applies: (row: Record<string, unknown>) => row.ownerId != null },
    { fields: ["type", "systemSortOrder"], applies: (row: Record<string, unknown>) => row.ownerId == null }
  ];
  if (model === "Ingredient") return [
    { fields: ["categoryId", "systemSortOrder"], applies: (row: Record<string, unknown>) => row.ownerId == null && row.status === "ACTIVE" },
    { fields: ["searchKey"], applies: (row: Record<string, unknown>) => row.ownerId == null && ["ACTIVE", "DISABLED"].includes(String(row.status)) },
    { fields: ["searchKey"], applies: (row: Record<string, unknown>) => row.ownerId == null && row.status === "PENDING" },
    { fields: ["ownerId", "searchKey"], applies: (row: Record<string, unknown>) => row.ownerId != null && row.status === "ACTIVE" },
    { fields: ["displaySortOrder"], applies: (row: Record<string, unknown>) => row.ownerId == null && row.status === "ACTIVE" }
  ];
  return [];
}

function primaryWhere(model: string, row: Record<string, unknown>) {
  const fields = primaryFields(model);
  if (!fields.length || fields.some(field => row[field] === undefined || row[field] === null)) {
    throw new BadRequestException(`${model} 快照记录缺少主键`);
  }
  if (fields.length === 1) return { [fields[0]]: row[fields[0]] };
  const name = modelInfo(model).primaryKey?.name ?? fields.join("_");
  return { [name]: Object.fromEntries(fields.map(field => [field, row[field]])) };
}

export function deletePrimaryWhere(model: string, row: Record<string, unknown>) {
  const fields = primaryFields(model);
  if (!fields.length || fields.some(field => row[field] === undefined || row[field] === null)) {
    throw new BadRequestException(`${model} 快照记录缺少主键`);
  }
  return Object.fromEntries(fields.map(field => [field, row[field]]));
}

export function snapshotReplacementKey(model: string, row: Record<string, unknown>) {
  if (model === "MedalTemplate") return JSON.stringify([row.code]);
  return rowKey(model, row);
}

export function snapshotUpsertArgs(model: string, row: Record<string, unknown>) {
  if (model === "MedalTemplate") {
    if (typeof row.code !== "string" || !row.code) throw new BadRequestException("MedalTemplate 快照记录缺少 code");
    return {
      where: { code: row.code },
      create: row,
      update: Object.fromEntries(Object.entries(row).filter(([key]) => key !== "id" && key !== "code"))
    };
  }
  const primary = new Set(primaryFields(model));
  return {
    where: primaryWhere(model, row),
    create: row,
    update: Object.fromEntries(Object.entries(row).filter(([key]) => !primary.has(key)))
  };
}

function rowKey(model: string, row: Record<string, unknown>) {
  return JSON.stringify(primaryFields(model).map(field => row[field]));
}

function mergeRows(target: SnapshotRows, source: SnapshotRows) {
  for (const [model, incoming] of Object.entries(source)) {
    const rows = target[model] ?? (target[model] = []);
    const seen = new Set(rows.map(row => rowKey(model, row)));
    for (const row of incoming) {
      const key = rowKey(model, row);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return target;
}

function rowCount(rows: SnapshotRows) {
  return Object.values(rows).reduce((sum, modelRows) => sum + modelRows.length, 0);
}

function snapshotDigest(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function mimeFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

function imageRefs(value: unknown, output = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    const pattern = /(?:https?:\/\/[^\s"'<>]+)?\/(?:static\/)?uploads\/[a-zA-Z0-9_./%=-]+(?:\?[^\s"'<>]*)?/gu;
    for (const match of value.matchAll(pattern)) {
      const reference = match[0].replace(/[),.;]+$/u, "");
      output.add(reference);
      if (reference.includes("&amp;")) output.add(reference.replace(/&amp;/gu, "&"));
    }
  } else if (Array.isArray(value)) {
    for (const item of value) imageRefs(item, output);
  } else if (isRecord(value)) {
    for (const item of Object.values(value)) imageRefs(item, output);
  }
  return output;
}

function storageKeyFromRef(reference: string) {
  try {
    const url = new URL(reference, "https://snapshot.invalid");
    const marker = "/uploads/";
    const index = url.pathname.indexOf(marker);
    if (index < 0) return null;
    const suffix = decodeURIComponent(url.pathname.slice(index + marker.length));
    if (!suffix || suffix.split("/").some(part => !part || part === "." || part === "..")) return null;
    return assetKey("uploads", suffix);
  } catch {
    return null;
  }
}

export function isLocalAssetReference(reference: string, request?: { protocol?: string; get?: (name: string) => string | undefined }) {
  if (reference.startsWith("/uploads/") || reference.startsWith("/static/uploads/")) return true;
  try {
    const candidate = new URL(reference);
    const host = request?.get?.("host");
    const requestOrigin = host ? `${request?.protocol || "http"}://${host}` : "";
    if (requestOrigin && candidate.origin === new URL(requestOrigin).origin) return true;
    const publicBase = process.env.ASSET_PUBLIC_BASE_URL?.trim();
    if (!publicBase) return false;
    const base = new URL(publicBase);
    const basePath = base.pathname.replace(/\/+$/u, "");
    const uploadsPrefix = `${basePath}/uploads/`;
    return candidate.origin === base.origin && candidate.pathname.startsWith(uploadsPrefix);
  } catch {
    return false;
  }
}

function rewriteRefs(value: unknown, replacements: Map<string, string>): unknown {
  if (typeof value === "string") {
    let result = value;
    for (const [source, target] of replacements) result = result.split(source).join(target);
    return result;
  }
  if (Array.isArray(value)) return value.map(item => rewriteRefs(item, replacements));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteRefs(item, replacements)]));
  return value;
}

export function snapshotRowValues(model: string, row: Record<string, unknown>) {
  const fields = new Map(modelInfo(model).fields.map(field => [field.name, field]));
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const field = fields.get(key);
    if (field?.type === "Json" && field.isRequired === false && value === null) return [key, Prisma.DbNull];
    if (field?.type === "DateTime" && typeof value === "string") return [key, new Date(value)];
    return [key, value];
  }));
}

function sortModels(models: string[]) {
  const included = new Set(models);
  const dependencies = new Map(models.map(model => [model, new Set<string>()]));
  for (const model of models) {
    for (const field of modelInfo(model).fields) {
      if (field.kind === "object" && field.relationFromFields.length && included.has(field.type) && field.type !== model) {
        dependencies.get(model)!.add(field.type);
      }
    }
  }
  const sorted: string[] = [];
  const remaining = new Set(models);
  while (remaining.size) {
    const next = Array.from(remaining).find(model => Array.from(dependencies.get(model) ?? []).every(parent => !remaining.has(parent)));
    if (!next) {
      sorted.push(...remaining);
      break;
    }
    remaining.delete(next);
    sorted.push(next);
  }
  return sorted;
}

function parseArchive(buffer: Buffer): SnapshotArchive {
  let zip: InstanceType<typeof AdmZip>;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new BadRequestException("ZIP 快照包无法读取");
  }
  const entries = zip.getEntries();
  if (!entries.length || entries.length > maxArchiveEntries) throw new BadRequestException("快照文件数量超出限制");
  const names = new Set<string>();
  let expandedBytes = 0;
  const files = new Map<string, Buffer>();
  for (const entry of entries) {
    const name = entry.entryName;
    if (entry.isDirectory) continue;
    if (name.startsWith("/") || name.includes("\\") || name.split("/").some(part => part === ".." || part === ".") || names.has(name)) {
      throw new BadRequestException("快照包包含重复或不安全的文件路径");
    }
    names.add(name);
    const declaredSize = entry.header?.size;
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 0 || declaredSize > maxExpandedEntryBytes) {
      throw new BadRequestException("快照单个文件展开后超过 200 MB 或大小无效");
    }
    expandedBytes += declaredSize;
    if (expandedBytes > maxExpandedBytes) throw new BadRequestException("快照包展开后超过 1 GB");
    const content = entry.getData();
    if (content.length !== declaredSize) throw new BadRequestException("快照文件展开大小与 ZIP 清单不一致");
    files.set(name, content);
  }
  let manifest: unknown;
  let data: unknown;
  try {
    manifest = JSON.parse(files.get("manifest.json")?.toString("utf8") ?? "null");
    data = JSON.parse(files.get("data.json")?.toString("utf8") ?? "null");
  } catch {
    throw new BadRequestException("快照清单或数据 JSON 格式无效");
  }
  if (!isRecord(manifest) || !isRecord(data)) throw new BadRequestException("快照包缺少清单或数据");
  const document = validateSnapshotDocument({ ...manifest, data });
  const expected = new Set(["manifest.json", "data.json", ...document.assets.map(asset => asset.path)]);
  if (expected.size !== files.size || Array.from(files.keys()).some(path => !expected.has(path))) {
    throw new BadRequestException("快照文件与清单不一致");
  }
  for (const asset of document.assets) {
    const content = files.get(asset.path);
    if (!content || content.length !== asset.size || snapshotDigest(content) !== asset.sha256) {
      throw new BadRequestException("快照图片文件校验失败");
    }
  }
  return { document, files };
}

function packageRows(document: SnapshotDocument) {
  return Object.values(document.data).reduce((result, rows) => mergeRows(result, rows), {} as SnapshotRows);
}

@Injectable()
export class AdminSystemDataSnapshotService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssetStorageService) private readonly assetStorage: AssetStorageService
  ) {}

  async exportPackage(value: unknown, request?: { protocol?: string; get?: (name: string) => string | undefined }): Promise<Buffer> {
    const categories = snapshotCategories(value);
    const sourceEnvironment = currentEnvironment();
    const data: SnapshotDocument["data"] = {} as SnapshotDocument["data"];
    await this.prisma.$transaction(async tx => {
      for (const category of categories) data[category] = await collectCategoryRows(tx, category);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 });

    const mediaRows: SnapshotRows = {};
    for (const category of categories) {
      for (const model of ["Recipe", "RecipeContentVersion", "SiteContent"]) {
        if (data[category][model]) mergeRows(mediaRows, { [model]: data[category][model] });
      }
    }
    const refs = imageRefs(mediaRows);
    const assets: SnapshotAsset[] = [];
    const zip = new AdmZip();
    const files = new Map<string, Buffer>();
    for (const reference of refs) {
      if (!isLocalAssetReference(reference, request)) continue;
      const sourceKey = storageKeyFromRef(reference);
      if (!sourceKey) continue;
      if (!assets.some(asset => asset.sourceKey === sourceKey)) {
        const content = await this.assetStorage.readBuffer(sourceKey).catch(() => null);
        if (!content) continue;
        if (content.length > 100 * 1024 * 1024) throw new ConflictException(`快照图片超过 100 MB：${reference}`);
        const sha256 = snapshotDigest(content);
        const path = `assets/${sha256}`;
        assets.push({ path, sha256, sourceKey, contentType: mimeFromPath(sourceKey), size: content.length, references: [reference] });
        files.set(path, content);
      } else {
        const asset = assets.find(item => item.sourceKey === sourceKey)!;
        asset.references.push(reference);
      }
    }
    const counts = Object.fromEntries(categories.map(category => [category, rowCount(data[category])]));
    const manifest: Omit<SnapshotDocument, "data"> = {
      schemaVersion: snapshotVersion,
      sourceEnvironment,
      exportedAt: new Date().toISOString(),
      categories,
      counts,
      assets
    };
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest), "utf8"));
    zip.addFile("data.json", Buffer.from(JSON.stringify(data), "utf8"));
    for (const [path, content] of files) zip.addFile(path, content);
    const archive = zip.toBuffer();
    if (archive.length > maxArchiveBytes) throw new ConflictException("生成的快照 ZIP 超过 200 MB，请减少导出类别或图片数量");
    return archive;
  }

  async previewImport(value: Buffer) {
    const { document } = parseArchive(value);
    const targetEnvironment = currentEnvironment();
    const conflicts: string[] = [];
    const prepared = await this.mapUsersToProtectedAccounts(document, this.prisma);
    const snapshot = prepared.document;
    conflicts.push(...prepared.conflicts);
    const directionConflict = await this.findDirectionConflict(snapshot.sourceEnvironment, targetEnvironment, this.prisma);
    if (directionConflict) conflicts.push(directionConflict);
    if (snapshot.categories.includes("recipes") && (snapshot.data.recipes.Recipe?.length ?? 0) > 0) {
      const poolCount = await this.prisma.publicContentUserPoolMember.count();
      if (!poolCount) conflicts.push("目标环境没有系统菜谱归属账号，暂时不能导入菜谱");
    }
    if (targetEnvironment !== "TEST") await this.findUserConflicts(snapshot, conflicts);
    const current = await this.collectCurrentRows(snapshot, this.prisma);
    await this.findUniqueConflicts(snapshot, current, conflicts, this.prisma, prepared.protectedUserIds);
    const removal = await this.findRemovalReferences(snapshot, current, this.prisma, prepared.protectedUserIds);
    conflicts.push(...removal.conflicts);
    const counts = await this.countRows(snapshot, this.prisma, current, removal.retainedUserIds);
    const missingDependencies = await this.findDependencies(snapshot, this.prisma);
    const previewFingerprint = this.previewFingerprint(value, targetEnvironment, current, removal.effects, removal.retainedUserIds, prepared.userIdMappings);
    return {
      schemaVersion: snapshotVersion,
      targetEnvironment,
      sourceExportedAt: snapshot.exportedAt || null,
      categories: snapshot.categories,
      counts,
      missingDependencies,
      assetCount: document.assets.length,
      conflicts,
      cleanupEffects: removal.effects,
      retainedUserCount: removal.retainedUserCount,
      remappedUserCount: prepared.userIdMappings.length,
      previewFingerprint,
      behavior: "替换已选择类别；受保护关联及其本地账号保留，预览列出的其他本地关联按提示清理或解除"
    };
  }

  async importPackage(value: Buffer, operationId: string, adminId: number, previewFingerprint: string, request: { protocol?: string; get?: (name: string) => string | undefined }) {
    const { document, files } = parseArchive(value);
    const targetEnvironment = currentEnvironment();
    const requestHash = snapshotDigest(Buffer.concat([Buffer.from(targetEnvironment), value]));
    const previous = await this.prisma.$transaction(tx => getAdminIdempotentResult<{ schemaVersion: string; importedCount: number; removedCount: number; counts: Record<string, unknown> }>(
      tx, operationId, "admin-system-data:import", adminId, requestHash
    ));
    if (previous) return previous;
    const replacements = new Map<string, string>();
    const createdKeys: string[] = [];
    const importKey = assetKey("uploads", "system-data-snapshots", randomUUID());
    let didRepeat = false;
    try {
      for (let index = 0; index < document.assets.length; index += 1) {
        const asset = document.assets[index] as SnapshotAsset;
        const source = files.get(asset.path)!;
        const extension = asset.sourceKey.split(".").pop()?.replace(/[^a-z0-9]/giu, "") || "jpg";
        const key = assetKey(importKey, `${index}.${extension}`);
        await this.assetStorage.writeObject(key, source, asset.contentType);
        createdKeys.push(key);
        const targetUrl = this.assetStorage.publicUrl(request, key);
        replacements.set(asset.sourceKey, key);
        for (const reference of asset.references) replacements.set(reference, targetUrl);
      }

      const result = await this.prisma.$transaction(async tx => {
        const repeated = await getAdminIdempotentResult<{ schemaVersion: string; importedCount: number; removedCount: number; counts: Record<string, unknown> }>(
          tx, operationId, "admin-system-data:import", adminId, requestHash
        );
        if (repeated) {
          didRepeat = true;
          return repeated;
        }
        const currentEnvironmentValue = currentEnvironment();
        const directionConflict = await this.findDirectionConflict(document.sourceEnvironment, currentEnvironmentValue, tx, true);
        if (directionConflict) throw new ConflictException(directionConflict);
        const prepared = await this.mapUsersToProtectedAccounts(document, tx);
        const snapshot = prepared.document;
        if (prepared.conflicts.length) throw new ConflictException(prepared.conflicts.join("；"));
        const conflicts: string[] = [];
        if (currentEnvironment() !== "TEST") await this.findUserConflicts(snapshot, conflicts, tx);
        if (conflicts.length) throw new ConflictException(conflicts.join("；"));
        const missing = await this.findDependencies(snapshot, tx);
        if (missing.length) throw new ConflictException(`缺少依赖数据：${missing.map(item => `${item.label} ${item.count} 条`).join("、")}`);
        await startAdminIdempotentOperation(tx, operationId, "admin-system-data:import", adminId, requestHash);
        const before: SnapshotDocument["data"] = {} as SnapshotDocument["data"];
        for (const category of snapshot.categories) before[category] = await collectCategoryRows(tx, category, { includePhoneLessUsers: currentEnvironmentValue === "TEST" && category === "users" });
        const uniqueConflicts: string[] = [];
        await this.findUniqueConflicts(snapshot, before, uniqueConflicts, tx, prepared.protectedUserIds);
        const removal = await this.findRemovalReferences(snapshot, before, tx, prepared.protectedUserIds);
        if (!/^[a-f0-9]{64}$/u.test(previewFingerprint) || this.previewFingerprint(value, currentEnvironmentValue, before, removal.effects, removal.retainedUserIds, prepared.userIdMappings) !== previewFingerprint) {
          throw new ConflictException("目标数据或快照文件已变化，请重新预览后再导入");
        }
        if (removal.conflicts.length) throw new ConflictException(removal.conflicts.join("；"));
        if (uniqueConflicts.length) throw new ConflictException(uniqueConflicts.join("；"));
        const incoming: SnapshotRows = {};
        const existing: SnapshotRows = {};
        for (const category of snapshot.categories) {
          mergeRows(incoming, snapshot.data[category]);
          mergeRows(existing, before[category]);
        }
        const ordered = sortModels(snapshotModels(document.categories));
        const importedUserIds = (incoming.User ?? []).map(row => Number(row.id));
        const incomingUserIdSet = new Set(importedUserIds);
        const retainedUserIds = new Set(removal.retainedUserIds);
        const removedUserIds = (existing.User ?? []).map(row => Number(row.id)).filter(id => !incomingUserIdSet.has(id) && !retainedUserIds.has(id));
        if (removedUserIds.length) await tx.idempotencyRecord.deleteMany({ where: { userId: { in: removedUserIds } } });
        if (snapshot.categories.includes("users") && importedUserIds.length) {
          await tx.authSession.deleteMany({ where: { userId: { in: importedUserIds } } });
          await tx.userWechatIdentity.deleteMany({ where: { userId: { in: importedUserIds } } });
          await tx.phoneChangeSession.deleteMany({ where: { userId: { in: importedUserIds } } });
        }
        let removedCount = 0;
        for (const model of [...ordered].reverse()) {
          if (model === "RecipeContentVersion") continue;
          const wanted = new Set((incoming[model] ?? []).map(row => snapshotReplacementKey(model, row)));
          const extra = (existing[model] ?? []).filter(row => !wanted.has(snapshotReplacementKey(model, row))
            && !(model === "User" && retainedUserIds.has(Number(row.id))));
          if (!extra.length) continue;
          const where = extra.map(row => deletePrimaryWhere(model, row));
          for (let index = 0; index < where.length; index += 500) {
            const result = await modelDelegate(tx, model).deleteMany({ where: { OR: where.slice(index, index + 500) } });
            removedCount += result.count;
          }
        }
        removedCount += removal.effects
          .filter(effect => effect.action === "CASCADE_DELETE")
          .reduce((sum, effect) => sum + effect.count, 0);
        const cleanData = mergeRows({}, incoming);
        for (const [model, rows] of Object.entries(cleanData)) {
          cleanData[model] = rows.map(row => rewriteRefs(row, replacements) as Record<string, unknown>);
          if (model === "User") {
            cleanData[model] = cleanData[model].map(row => ({
              ...row,
              passwordHash: null,
              openid: null,
              unionid: null,
              sessionVersion: Number(row.sessionVersion ?? 0) + 1
            }));
          }
        }
        const pool = snapshot.categories.includes("recipes")
          ? await tx.publicContentUserPoolMember.findMany({ orderBy: { userId: "asc" }, select: { userId: true } })
          : [];
        if (snapshot.categories.includes("recipes") && (cleanData.Recipe ?? []).length && !pool.length) {
          throw new ConflictException("目标环境没有系统菜谱归属账号，无法导入菜谱");
        }
        let importedCount = 0;
        for (const model of ordered) {
          const rows = cleanData[model] ?? [];
          const delegate = modelDelegate(tx, model);
          for (const [index, raw] of rows.entries()) {
            const row = snapshotRowValues(model, raw);
            if (model === "Recipe" && (row as Record<string, unknown>).isInspiration === true) {
              (row as Record<string, unknown>).ownerId = pool[Number((row as Record<string, unknown>).id) % pool.length].userId;
              (row as Record<string, unknown>).reportCount = 0;
              (row as Record<string, unknown>).collectCount = 0;
            }
            if (model === "SiteContent") (row as Record<string, unknown>).updatedByAdminId = null;
            try {
              await delegate.upsert(snapshotUpsertArgs(model, row as Record<string, unknown>));
            } catch (error) {
              throw new ConflictException(`${model} 第 ${index + 1} 条记录无法写入：${error instanceof Error ? error.message : "数据冲突"}`);
            }
            importedCount += 1;
          }
        }
        const wantedVersionIds = new Set((incoming.RecipeContentVersion ?? []).map(row => rowKey("RecipeContentVersion", row)));
        const extraVersions = (existing.RecipeContentVersion ?? []).filter(row => !wantedVersionIds.has(rowKey("RecipeContentVersion", row)));
        for (let index = 0; index < extraVersions.length; index += 500) {
          try {
            const result = await tx.recipeContentVersion.deleteMany({
              where: { OR: extraVersions.slice(index, index + 500).map(row => deletePrimaryWhere("RecipeContentVersion", row)) }
            });
            removedCount += result.count;
          } catch {
            throw new ConflictException("更新所选数据后，本地仍有饭局菜品引用待清理的旧菜谱版本；导入已回滚，请重新校验快照");
          }
        }
        await syncSequences(tx, ordered);
        const counts = await this.countRows(snapshot, tx, before, removal.retainedUserIds);
        const result = { schemaVersion: snapshotVersion, targetEnvironment, importedCount, removedCount, counts };
        await tx.auditEvent.create({
          data: {
            actorType: "ADMIN", actorAdminId: adminId, action: "SYSTEM_DATA_IMPORTED", objectType: "SYSTEM_DATA_PACKAGE",
            payload: { schemaVersion: snapshotVersion, sourceEnvironment: snapshot.sourceEnvironment, targetEnvironment, categories: snapshot.categories, importedCount, removedCount, operationId } as Prisma.InputJsonValue
          }
        });
        await completeAdminIdempotentOperation(tx, operationId, "admin-system-data:import", adminId, requestHash, result);
        return result;
      }, { timeout: 120_000 });
      if (didRepeat) await Promise.allSettled(createdKeys.map(key => this.assetStorage.deleteObject(key)));
      return result;
    } catch (error) {
      await Promise.allSettled(createdKeys.map(key => this.assetStorage.deleteObject(key)));
      throw error;
    }
  }

  private async countRows(document: SnapshotDocument, db: object = this.prisma, existingRows?: SnapshotDocument["data"], retainedUserIds: number[] = []) {
    const result: Record<string, { total: number; existing: number; new: number; removed: number }> = {};
    const incomingUserIds = new Set((document.data.users?.User ?? []).map(row => Number(row.id)));
    const retainedOnlyUserIds = new Set(retainedUserIds.filter(id => !incomingUserIds.has(id)));
    for (const category of document.categories) {
      const target = existingRows?.[category] ?? await collectCategoryRows(db, category);
      const incoming = document.data[category];
      let existing = 0;
      let current = 0;
      for (const [model, targetRows] of Object.entries(target)) {
        const countableRows = model === "User" && retainedUserIds.length
          ? targetRows.filter(row => !retainedOnlyUserIds.has(Number(row.id)))
          : targetRows;
        current += countableRows.length;
        const incomingKeys = new Set((incoming[model] ?? []).map(row => rowKey(model, row)));
        existing += countableRows.filter(row => incomingKeys.has(rowKey(model, row))).length;
      }
      const total = rowCount(incoming);
      result[category] = { total, existing, new: Math.max(0, total - existing), removed: Math.max(0, current - existing) };
    }
    return result;
  }

  private previewFingerprint(value: Buffer, environment: DataEnvironment, rows: SnapshotDocument["data"], cleanupEffects: Array<{ model: string; action: string; count: number }> = [], retainedUserIds: number[] = [], userIdMappings: Array<[number, number]> = []) {
    const state = Object.fromEntries(Object.keys(rows).sort().map(category => {
      const models = rows[category as SnapshotCategory];
      return [category, Object.fromEntries(Object.keys(models).sort().map(model => [
        model,
        [...models[model]].sort((left, right) => rowKey(model, left).localeCompare(rowKey(model, right)))
      ]))];
    }));
    return snapshotDigest(Buffer.from(JSON.stringify({ archive: snapshotDigest(value), environment, state, cleanupEffects, retainedUserIds: [...retainedUserIds].sort((a, b) => a - b), userIdMappings }), "utf8"));
  }

  private async collectCurrentRows(document: SnapshotDocument, db: object) {
    const rows: SnapshotDocument["data"] = {} as SnapshotDocument["data"];
    for (const category of document.categories) rows[category] = await collectCategoryRows(db, category, { includePhoneLessUsers: currentEnvironment() === "TEST" && category === "users" });
    return rows;
  }

  private async findRemovalReferences(document: SnapshotDocument, current: SnapshotDocument["data"], db: object, protectedUserIds?: number[]) {
    const incoming: SnapshotRows = {};
    const existing: SnapshotRows = {};
    for (const category of document.categories) {
      mergeRows(incoming, document.data[category]);
      mergeRows(existing, current[category]);
    }
    const selectedModels = new Set(snapshotModels(document.categories));
    const modelNames = Prisma.dmmf.datamodel.models.map(model => model.name);
    const allowedAuthCleanup = new Set(["AuthSession", "UserWechatIdentity", "PhoneChangeSession"]);
    const conflicts = new Map<string, number>();
    const cleanupRows = new Map<string, Set<string>>();
    const protectedModels = new Set(["StorageLedger", "AuditEvent", "MembershipCode", "DiningGroup", "DiningGroupMember", "DiningGroupInvite", "PublicContentUserPoolMember"]);
    const shouldRetainProtectedUsers = currentEnvironment() === "TEST" && document.categories.includes("users");
    const retainedUserIds = new Set(protectedUserIds ?? (shouldRetainProtectedUsers ? await this.findProtectedUserIds(db) : []));
    const incomingUserIds = new Set((incoming.User ?? []).map(row => Number(row.id)));
    const retainedUserCount = Array.from(retainedUserIds).filter(id => (existing.User ?? []).some(row => Number(row.id) === id)).length;
    for (const [parentModel, parentRows] of Object.entries(existing)) {
      const wanted = new Set((incoming[parentModel] ?? []).map(row => rowKey(parentModel, row)));
      const removed = parentRows.filter(row => !wanted.has(rowKey(parentModel, row))
        && !(parentModel === "User" && retainedUserIds.has(Number(row.id))));
      if (!removed.length) continue;
      for (const childModel of modelNames) {
        if (selectedModels.has(childModel) || allowedAuthCleanup.has(childModel)) continue;
        for (const relation of modelInfo(childModel).fields.filter(field => field.kind === "object" && field.type === parentModel && field.relationFromFields.length)) {
          const tuples = removed.map(row => Object.fromEntries(relation.relationToFields.map((field, index) => [relation.relationFromFields[index], row[field]])))
            .filter(tuple => Object.values(tuple).every(value => value !== null && value !== undefined));
          if (!tuples.length) continue;
          const delegate = modelDelegate(db, childModel);
          const referencedKeys = new Set<string>();
          for (let index = 0; index < tuples.length; index += 300) {
            const primary = primaryFields(childModel);
            const references = await delegate.findMany({
              where: { OR: tuples.slice(index, index + 300) },
              select: Object.fromEntries(primary.map(field => [field, true]))
            });
            for (const row of references) referencedKeys.add(rowKey(childModel, row));
          }
          const referenceCount = referencedKeys.size;
          if (referenceCount) {
            if (childModel === "IdempotencyRecord") {
              const key = `${childModel}:CASCADE_DELETE`;
              const rows = cleanupRows.get(key) ?? new Set<string>();
              referencedKeys.forEach(id => rows.add(id));
              cleanupRows.set(key, rows);
              continue;
            }
            if (protectedModels.has(childModel)) {
              const key = `${parentModel}->${childModel}`;
              conflicts.set(key, (conflicts.get(key) ?? 0) + referenceCount);
              continue;
            }
            const onDelete = relation.relationOnDelete ?? (relation.isRequired ? "Cascade" : "SetNull");
            if (onDelete === "Restrict" || onDelete === "NoAction") {
              const key = `${parentModel}->${childModel}`;
              conflicts.set(key, (conflicts.get(key) ?? 0) + referenceCount);
              continue;
            }
            const action = onDelete === "Cascade" ? "CASCADE_DELETE" : "SET_NULL";
            const key = `${childModel}:${action}`;
            const rows = cleanupRows.get(key) ?? new Set<string>();
            referencedKeys.forEach(id => rows.add(id));
            cleanupRows.set(key, rows);
          }
        }
      }
    }
    const removedIngredientIds = this.removedIds("Ingredient", incoming, existing);
    const removedUnitIds = this.removedIds("Unit", incoming, existing);
    if (removedIngredientIds.size || removedUnitIds.size) {
      const incomingVersions = incoming.RecipeContentVersion ?? [];
      const replacedVersionIds = new Set((existing.RecipeContentVersion ?? []).map(row => rowKey("RecipeContentVersion", row)));
      const ingredientRefs = new Set<number>();
      const unitRefs = new Set<number>();
      const collectJsonRefs = (versions: Array<Record<string, unknown>>) => {
        for (const version of versions) {
          const items = Array.isArray(version.ingredientsJson) ? version.ingredientsJson : [];
          for (const item of items) {
            if (!isRecord(item)) continue;
            if (Number.isSafeInteger(item.ingredientId)) ingredientRefs.add(Number(item.ingredientId));
            const amount = isRecord(item.amount) ? item.amount : null;
            if (amount && Number.isSafeInteger(amount.unitId)) unitRefs.add(Number(amount.unitId));
          }
        }
      };
      collectJsonRefs(incomingVersions);
      const versionDelegate = modelDelegate(db, "RecipeContentVersion");
      let cursor = 0;
      while (true) {
        const page = await versionDelegate.findMany({
          where: { id: { gt: cursor } },
          select: { id: true, ingredientsJson: true },
          orderBy: { id: "asc" },
          take: 1000
        });
        if (!page.length) break;
        cursor = Number(page[page.length - 1].id);
        collectJsonRefs(page.filter(row => !replacedVersionIds.has(rowKey("RecipeContentVersion", row))));
        if (page.length < 1000) break;
      }
      const ingredientCount = Array.from(removedIngredientIds).filter(id => ingredientRefs.has(id)).length;
      const unitCount = Array.from(removedUnitIds).filter(id => unitRefs.has(id)).length;
      if (ingredientCount) conflicts.set("RecipeContentVersion->IngredientJson", ingredientCount);
      if (unitCount) conflicts.set("RecipeContentVersion->UnitJson", unitCount);
    }
    const labels: Record<string, string> = {
      DiningEventShareInvite: "饭局分享邀请",
      DiningEventMemoryShare: "饭局纪念册分享",
      RecipeImportItem: "菜谱导入记录",
      MealReminder: "饭局提醒",
      IdempotencyRecord: "本地幂等记录"
    };
    for (const [key, rows] of cleanupRows) {
      const [model, action] = key.split(":");
      if (action !== "SET_NULL") continue;
      const deleted = cleanupRows.get(`${model}:CASCADE_DELETE`);
      if (deleted) rows.forEach(id => deleted.has(id) && rows.delete(id));
      if (!rows.size) cleanupRows.delete(key);
    }
    const effects = Array.from(cleanupRows, ([key, rows]) => {
      const [model, action] = key.split(":");
      return { model, label: labels[model] ?? model, action, count: rows.size };
    }).sort((left, right) => left.label.localeCompare(right.label));
    const removalConflicts = Array.from(conflicts, ([edge, count]) =>
      `清理所选数据会影响受保护关联 ${edge}（${count} 条），请先处理该关联`
    );
    return { conflicts: removalConflicts, effects, retainedUserIds: Array.from(retainedUserIds).sort((a, b) => a - b), retainedUserCount };
  }

  private async findProtectedUserIds(db: object) {
    const relations = await Promise.all([
      modelDelegate(db, "MembershipCode").findMany({ where: { redeemedByUserId: { not: null } }, select: { redeemedByUserId: true } }),
      modelDelegate(db, "PublicContentUserPoolMember").findMany({ select: { userId: true } }),
      modelDelegate(db, "StorageLedger").findMany({ select: { userId: true } }),
      modelDelegate(db, "AuditEvent").findMany({ where: { actorUserId: { not: null } }, select: { actorUserId: true } })
    ]);
    const ids = new Set<number>();
    for (const rows of relations) for (const row of rows) {
      const id = Number(row.userId ?? row.redeemedByUserId ?? row.actorUserId);
      if (Number.isSafeInteger(id) && id > 0) ids.add(id);
    }
    return ids;
  }

  private removedIds(model: string, incoming: SnapshotRows, existing: SnapshotRows) {
    const wanted = new Set((incoming[model] ?? []).map(row => rowKey(model, row)));
    return new Set((existing[model] ?? [])
      .filter(row => !wanted.has(rowKey(model, row)))
      .map(row => Number(row.id))
      .filter(Number.isSafeInteger));
  }

  private async findUniqueConflicts(document: SnapshotDocument, current: SnapshotDocument["data"], conflicts: string[], db: object, retainedUserIds: number[] = []) {
    const incoming = packageRows(document);
    const managed: SnapshotRows = {};
    for (const category of document.categories) mergeRows(managed, current[category]);
    for (const [model, rows] of Object.entries(incoming)) {
      const primary = primaryFields(model);
      const uniqueIndexes = [
        ...(modelInfo(model).uniqueFields ?? []).map(fields => ({ fields, applies: () => true })),
        ...modelInfo(model).fields.filter(field => field.isUnique).map(field => ({ fields: [field.name], applies: () => true })),
        ...partialUniqueIndexes(model)
      ].filter(index => index.fields.length && index.fields.some(field => !primary.includes(field)));
      for (const index of uniqueIndexes) {
        const { fields } = index;
        const incomingKeys = new Map<string, string>();
        const validRows = rows.filter(row =>
          fields.every(field => row[field] !== null && row[field] !== undefined)
          && index.applies(row)
        );
        for (const row of validRows) {
          const key = JSON.stringify(fields.map(field => row[field]));
          const primaryKey = rowKey(model, row);
          const previous = incomingKeys.get(key);
          if (previous && previous !== primaryKey) conflicts.push(`${model} 快照内 ${fields.join("/")} 存在重复值`);
          incomingKeys.set(key, primaryKey);
        }
        const targetIds = new Set((managed[model] ?? []).map(row => rowKey(model, row)));
        const wantedIds = new Set(rows.map(row => rowKey(model, row)));
        const delegate = modelDelegate(db, model);
        const selected = Object.fromEntries([...new Set([...fields, ...primary])].map(field => [field, true]));
        for (let index = 0; index < validRows.length; index += 300) {
          const chunk = validRows.slice(index, index + 300);
          const matches = await delegate.findMany({
            where: { OR: chunk.map(row => Object.fromEntries(fields.map(field => [field, row[field]]))) },
            select: selected
          });
          for (const found of matches) {
            const foundKey = rowKey(model, found);
            if (model === "User" && retainedUserIds.includes(Number(found.id))) {
              if (wantedIds.has(foundKey)) continue;
              conflicts.push(`用户的 ${fields.join("/")} 与需要保留的本地关联账号冲突`);
              continue;
            }
            if (wantedIds.has(foundKey) || targetIds.has(foundKey)) continue;
            if (["RecipeNutritionSnapshot", "RecipeVersionTag"].includes(model)) {
              const category = await this.selectedRecipeDataCategory(document, found, db);
              if (category) {
                const rowsInCategory = current[category][model] ?? (current[category][model] = []);
                if (!rowsInCategory.some(row => rowKey(model, row) === foundKey)) rowsInCategory.push(found);
                continue;
              }
            }
            const categoryHint = ["RecipeNutritionSnapshot", "RecipeVersionTag"].includes(model) && !document.categories.includes("recipes")
              ? `；请在线上重新导出并同时选择“菜谱”类别`
              : "";
            conflicts.push(`${model} 的 ${fields.join("/")} 与目标环境未选数据冲突${categoryHint}`);
          }
        }
      }
    }
  }

  private async selectedRecipeDataCategory(document: SnapshotDocument, row: Record<string, unknown>, db: object) {
    const versionId = Number(row.recipeVersionId);
    if (!Number.isSafeInteger(versionId)) return null;
    for (const category of ["recipes", "users"] as const) {
      if (document.categories.includes(category)
        && (document.data[category].RecipeContentVersion ?? []).some(version => Number(version.id) === versionId)) {
        return category;
      }
    }
    const recipes = await modelDelegate(db, "Recipe").findMany({
      where: { OR: [{ currentVersionId: versionId }, { originVersionId: versionId }] },
      select: { isInspiration: true, inspirationCategoryId: true }
    });
    if (!recipes.length) return null;
    if (document.categories.includes("recipes") && recipes.some(recipe => recipe.isInspiration === true && recipe.inspirationCategoryId != null)) return "recipes";
    if (document.categories.includes("users") && recipes.some(recipe => recipe.isInspiration === false)) return "users";
    return null;
  }

  private async mapUsersToProtectedAccounts(document: SnapshotDocument, db: object) {
    if (currentEnvironment() !== "TEST" || !document.categories.includes("users")) {
      return { document, protectedUserIds: [] as number[], userIdMappings: [] as Array<[number, number]>, conflicts: [] as string[] };
    }
    const protectedUserIds = Array.from(await this.findProtectedUserIds(db)).sort((a, b) => a - b);
    if (!protectedUserIds.length) return { document, protectedUserIds, userIdMappings: [] as Array<[number, number]>, conflicts: [] as string[] };
    const protectedUsers = await modelDelegate(db, "User").findMany({
      where: { id: { in: protectedUserIds } },
      select: { id: true, phone: true }
    });
    const protectedByPhone = new Map(protectedUsers
      .filter(row => typeof row.phone === "string" && row.phone.length > 0)
      .map(row => [String(row.phone), Number(row.id)]));
    const users = document.data.users?.User ?? [];
    const sourceIds = new Set(users.map(row => Number(row.id)));
    const userIdMappings = users.flatMap(row => {
      const sourceId = Number(row.id);
      const targetId = typeof row.phone === "string" ? protectedByPhone.get(row.phone) : undefined;
      return targetId !== undefined && sourceId !== targetId ? [[sourceId, targetId] as [number, number]] : [];
    });
    const mappingTargets = new Map<number, number>();
    for (const [sourceId, targetId] of userIdMappings) mappingTargets.set(targetId, (mappingTargets.get(targetId) ?? 0) + 1);
    const conflicts = userIdMappings
      .filter(([sourceId, targetId]) => mappingTargets.get(targetId)! > 1 || (sourceIds.has(targetId) && !userIdMappings.some(([id, mappedId]) => id === targetId && mappedId === targetId)))
      .map(() => "手机号匹配到的受保护本地账号 ID 与快照中的其他账号 ID 冲突");
    if (!userIdMappings.length) return { document, protectedUserIds, userIdMappings, conflicts };

    const mapping = new Map(userIdMappings);
    const data = Object.fromEntries(Object.entries(document.data).map(([category, rows]) => [category,
      Object.fromEntries(Object.entries(rows).map(([model, modelRows]) => [model, modelRows.map(row => ({ ...row }))]))
    ])) as SnapshotDocument["data"];
    for (const row of data.users.User ?? []) {
      const targetId = mapping.get(Number(row.id));
      if (targetId !== undefined) row.id = targetId;
    }
    for (const rows of Object.values(data)) for (const [model, modelRows] of Object.entries(rows)) {
      const userRelations = modelInfo(model).fields.filter(field => field.kind === "object" && field.type === "User" && field.relationFromFields.length);
      for (const row of modelRows) for (const relation of userRelations) {
        relation.relationFromFields.forEach((field, index) => {
          if (relation.relationToFields[index] !== "id") return;
          const targetId = mapping.get(Number(row[field]));
          if (targetId !== undefined) row[field] = targetId;
        });
      }
    }
    return { document: { ...document, data }, protectedUserIds, userIdMappings, conflicts };
  }

  private async findDependencies(document: SnapshotDocument, db: object) {
    const rows = packageRows(document);
    const included = new Set(Object.keys(rows));
    const missingByModel = new Map<string, Set<string>>();
    for (const [childModel, childRows] of Object.entries(rows)) {
      const fields = modelInfo(childModel).fields;
      for (const relation of fields.filter(field => field.kind === "object" && field.relationFromFields.length)) {
        const parentModel = relation.type;
        const parentFields = relation.relationToFields;
        const tuples = new Map<string, Record<string, unknown>>();
        for (const row of childRows) {
          const tuple = Object.fromEntries(relation.relationFromFields.map((field, index) => [parentFields[index], row[field]]));
          if (Object.values(tuple).some(value => value === null || value === undefined)) continue;
          tuples.set(JSON.stringify(tuple), tuple);
        }
        if (!tuples.size) continue;
        const suppliedRows = included.has(parentModel) ? rows[parentModel] ?? [] : [];
        const supplied = new Set(suppliedRows.map(row => JSON.stringify(Object.fromEntries(parentFields.map(field => [field, row[field]])))));
        const unresolved = Array.from(tuples.entries()).filter(([key]) => !supplied.has(key));
        if (!unresolved.length) continue;
        const found = new Set<string>();
        const delegate = modelDelegate(db, parentModel);
        for (let index = 0; index < unresolved.length; index += 300) {
          const chunk = unresolved.slice(index, index + 300);
          const select = Object.fromEntries(parentFields.map(field => [field, true]));
          const existing = await delegate.findMany({
            where: { OR: chunk.map(([, tuple]) => tuple) },
            select
          });
          for (const item of existing) found.add(JSON.stringify(Object.fromEntries(parentFields.map(field => [field, item[field]]))));
        }
        const missing = missingByModel.get(parentModel) ?? new Set<string>();
        for (const [key] of unresolved) if (!found.has(key)) missing.add(key);
        if (missing.size) missingByModel.set(parentModel, missing);
      }
    }
    const jsonMissing = new Map<string, Set<number>>();
    const versions = rows.RecipeContentVersion ?? [];
    const includedIngredients = new Set((rows.Ingredient ?? []).map(row => Number(row.id)));
    const includedUnits = new Set((rows.Unit ?? []).map(row => Number(row.id)));
    const ingredientRefs = new Map<number, Set<string>>();
    const unitRefs = new Set<number>();
    for (const version of versions) {
      const ingredients = Array.isArray(version.ingredientsJson) ? version.ingredientsJson : [];
      for (const item of ingredients) {
        if (!isRecord(item)) continue;
        if (Number.isSafeInteger(item.ingredientId) && Number(item.ingredientId) > 0) {
          const sources = ingredientRefs.get(Number(item.ingredientId)) ?? new Set<string>();
          sources.add(item.source === "PERSONAL" ? "PERSONAL" : "SYSTEM");
          ingredientRefs.set(Number(item.ingredientId), sources);
        }
        const amount = isRecord(item.amount) ? item.amount : null;
        if (amount && Number.isSafeInteger(amount.unitId) && Number(amount.unitId) > 0) unitRefs.add(Number(amount.unitId));
      }
    }
    const ingredientDelegate = modelDelegate(db, "Ingredient");
    const ingredientIds = Array.from(ingredientRefs.keys()).filter(id => !includedIngredients.has(id));
    const foundIngredients = new Map<number, unknown>();
    for (let index = 0; index < ingredientIds.length; index += 300) {
      const found = await ingredientDelegate.findMany({ where: { id: { in: ingredientIds.slice(index, index + 300) } }, select: { id: true, ownerId: true } });
      for (const ingredient of found) foundIngredients.set(Number(ingredient.id), ingredient.ownerId);
    }
    for (const id of ingredientIds) {
      const sources = ingredientRefs.get(id)!;
      const ownerId = foundIngredients.get(id);
      const found = ownerId !== undefined && (
        (sources.has("SYSTEM") && ownerId === null)
        || (sources.has("PERSONAL") && ownerId !== null)
      );
      if (!found) {
        const category = sources.has("PERSONAL") ? "users" : "systemIngredients";
        const missing = jsonMissing.get(category) ?? new Set<number>();
        missing.add(id);
        jsonMissing.set(category, missing);
      }
    }
    const missingUnitIds = Array.from(unitRefs).filter(id => !includedUnits.has(id));
    if (missingUnitIds.length) {
      const found = new Set<number>();
      for (let index = 0; index < missingUnitIds.length; index += 300) {
        const unitRows = await modelDelegate(db, "Unit").findMany({ where: { id: { in: missingUnitIds.slice(index, index + 300) } }, select: { id: true } });
        for (const row of unitRows) found.add(Number(row.id));
      }
      const missing = new Set(missingUnitIds.filter(id => !found.has(id)));
      if (missing.size) jsonMissing.set("units", missing);
    }

    const results = Array.from(missingByModel, ([model, missing]) => {
      const category = snapshotCategoryOfModel(model);
      return {
        category,
        label: category === "unknown" ? model : `依赖${snapshotCategoryLabels[category]}`,
        count: missing.size
      };
    });
    for (const [category, missing] of jsonMissing) {
      const key = category as SnapshotCategory;
      results.push({ category: key, label: `菜谱正文引用的${snapshotCategoryLabels[key]}`, count: missing.size });
    }
    return results;
  }

  private async findUserConflicts(document: SnapshotDocument, conflicts: string[], db: object = this.prisma) {
    const users = document.data.users?.User ?? [];
    if (!document.categories.includes("users") || !users.length) return;
    const delegate = modelDelegate(db, "User");
    const incomingIds = new Set(users.map(row => Number(row.id)));
    const phones = users.map(row => row.phone).filter((phone): phone is string => typeof phone === "string" && phone.length > 0);
    const byPhone = phones.length ? await delegate.findMany({ where: { phone: { in: phones } }, select: { id: true, phone: true } }) : [];
    const byId = await delegate.findMany({ where: { id: { in: Array.from(incomingIds) } }, select: { id: true, phone: true, uid: true, cookNo: true } });
    const uids = users.map(row => row.uid).filter(value => typeof value === "number");
    const cookNos = users.map(row => row.cookNo).filter((value): value is string => typeof value === "string");
    const byPublicIdentity = uids.length || cookNos.length
      ? await delegate.findMany({ where: { OR: [{ uid: { in: uids } }, { cookNo: { in: cookNos } }] }, select: { id: true, uid: true, cookNo: true } })
      : [];
    const snapshotById = new Map(users.map(row => [Number(row.id), row]));
    for (const existing of byPhone) {
      const snapshot = snapshotById.get(Number(existing.id));
      if (!incomingIds.has(Number(existing.id))) conflicts.push(`手机号 ${existing.phone} 已绑定不同 ID 的本地账号`);
      else if (snapshot?.phone !== existing.phone) conflicts.push(`用户 ID ${existing.id} 在本地绑定了其他手机号`);
    }
    for (const existing of byId) {
      const snapshot = snapshotById.get(Number(existing.id));
      if (snapshot && existing.phone && snapshot.phone !== existing.phone) conflicts.push(`用户 ID ${existing.id} 与本地手机号冲突`);
      if (snapshot && (snapshot.uid !== existing.uid || snapshot.cookNo !== existing.cookNo)) conflicts.push(`用户 ID ${existing.id} 与本地账号标识冲突`);
    }
    for (const existing of byPublicIdentity) {
      const snapshot = snapshotById.get(Number(existing.id));
      if (!snapshot || snapshot.uid !== existing.uid || snapshot.cookNo !== existing.cookNo) conflicts.push(`线上账号标识 ${existing.uid} / ${existing.cookNo} 已被其他本地账号占用`);
    }
  }

  private async findDirectionConflict(sourceEnvironment: DataEnvironment, targetEnvironment: DataEnvironment, db: PrismaService | Prisma.TransactionClient, lockFirstOnlineImport = false) {
    if (targetEnvironment === "TEST" && sourceEnvironment !== "ONLINE") return "测试环境只允许导入线上快照";
    if (targetEnvironment === "ONLINE" && sourceEnvironment !== "TEST") return "线上环境只允许导入测试环境快照";
    if (targetEnvironment === "ONLINE") {
      if (lockFirstOnlineImport) await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('system-data-first-online-import', 0))::text`;
      const alreadyImported = await db.auditEvent.findFirst({
        where: { action: "SYSTEM_DATA_IMPORTED", objectType: "SYSTEM_DATA_PACKAGE", payload: { path: ["sourceEnvironment"], equals: "TEST" } }, select: { id: true }
      });
      if (alreadyImported) return "测试环境快照已同步到线上；线上后续只允许导入到测试环境";
    }
    return null;
  }
}

async function syncSequences(tx: Prisma.TransactionClient, models: string[]) {
  for (const model of models) {
    const info = modelInfo(model);
    const fields = primaryFields(model);
    if (fields.length !== 1 || fields[0] !== "id") continue;
    const table = info.dbName;
    if (!table || !/^[a-z0-9_]+$/u.test(table)) continue;
    await tx.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM "${table}"), 1), 1), true)`);
  }
}

function currentEnvironment(): DataEnvironment {
  const value = process.env.SYSTEM_DATA_ENVIRONMENT?.trim().toUpperCase();
  if (value !== "TEST" && value !== "ONLINE") throw new ConflictException("未配置有效的 SYSTEM_DATA_ENVIRONMENT，系统数据同步已停用");
  return value;
}
