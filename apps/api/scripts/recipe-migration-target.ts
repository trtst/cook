import { createHash } from "node:crypto";

export type RecipeMigrationTarget = "TEST" | "ONLINE";

type Environment = Record<string, string | undefined>;

function normalizedPrefix(environment: Environment) {
  return environment.ASSET_STORAGE_PREFIX?.trim().replace(/^\/+|\/+$/gu, "") || "";
}

export function parseRecipeMigrationTarget(argv: string[]): RecipeMigrationTarget {
  const raw = argv.find(argument => argument.startsWith("--target="))?.slice("--target=".length);
  if (raw !== "TEST" && raw !== "ONLINE") throw new Error("必须指定 --target=TEST 或 --target=ONLINE");
  return raw;
}

export function recipeMigrationFingerprint(environment: Environment) {
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL 未配置，拒绝运行菜谱图片迁移");

  let databaseIdentity: string;
  try {
    const parsed = new URL(databaseUrl);
    databaseIdentity = `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    throw new Error("DATABASE_URL 格式无效，拒绝运行菜谱图片迁移");
  }

  const driver = environment.ASSET_STORAGE_DRIVER?.trim() || "local";
  const publicBaseUrl = environment.ASSET_PUBLIC_BASE_URL?.trim() || "";
  const assetIdentity = driver === "oss"
    ? `${driver}:${environment.OSS_REGION?.trim() || ""}:${environment.OSS_BUCKET?.trim() || ""}:${environment.OSS_ENDPOINT?.trim() || ""}:${normalizedPrefix(environment)}:${publicBaseUrl}`
    : `${driver}:${environment.APP_ASSET_DIR?.trim() || "default"}:${normalizedPrefix(environment)}:${publicBaseUrl}`;
  return createHash("sha256").update(`${databaseIdentity}\n${assetIdentity}`).digest("hex");
}

export function assertRecipeMigrationTarget(
  target: RecipeMigrationTarget,
  write: boolean,
  environment: Environment,
  argv: string[]
) {
  const configuredEnvironment = environment.SYSTEM_DATA_ENVIRONMENT?.trim().toUpperCase();
  if (configuredEnvironment !== target) {
    throw new Error(`SYSTEM_DATA_ENVIRONMENT 必须为 ${target}，当前配置与目标不匹配`);
  }

  if (target === "ONLINE") {
    if (environment.ASSET_STORAGE_DRIVER !== "oss" || normalizedPrefix(environment) !== "O") {
      throw new Error("ONLINE 目标必须明确配置 OSS 且 ASSET_STORAGE_PREFIX=O");
    }
    if (write && !argv.includes("--confirm-online-write")) {
      throw new Error("线上写入需要显式添加 --confirm-online-write");
    }
  } else if (environment.ASSET_STORAGE_DRIVER === "oss" && normalizedPrefix(environment) !== "dev") {
    throw new Error("TEST 目标的 OSS 前缀必须为 dev");
  }
}
