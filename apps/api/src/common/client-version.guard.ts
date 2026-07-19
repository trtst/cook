import { CanActivate, ExecutionContext, HttpException, Injectable } from "@nestjs/common";
import type { RequestContext, RequestWithContext } from "./auth-context";

interface HttpRequest {
  path?: string;
  route?: {
    path?: string;
  };
}

interface VersionPolicy {
  minVersion: string;
  minBuild: number;
  upgradeUrl: string;
}

const adminWebPolicy: VersionPolicy = {
  minVersion: process.env.ADMIN_MIN_SUPPORTED_VERSION ?? "0.1.0",
  minBuild: Number(process.env.ADMIN_MIN_SUPPORTED_BUILD ?? 1),
  upgradeUrl: process.env.ADMIN_UPGRADE_URL ?? ""
};

function compareVersion(current: string, min: string) {
  const currentParts = current.split(".").map(part => Number(part));
  const minParts = min.split(".").map(part => Number(part));
  const length = Math.max(currentParts.length, minParts.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = Number.isFinite(currentParts[index]) ? currentParts[index] : 0;
    const minPart = Number.isFinite(minParts[index]) ? minParts[index] : 0;

    if (currentPart > minPart) return 1;
    if (currentPart < minPart) return -1;
  }

  return 0;
}

function isAdminRequest(request: HttpRequest) {
  return request.path?.startsWith("/api/admin") || request.route?.path?.toString().startsWith("/admin");
}

function buildUpgradeError(context: RequestContext | undefined, policy: VersionPolicy) {
  return new HttpException({
    code: 426,
    message: "当前版本过低，请升级后继续使用",
    data: {
      minSupportedVersion: policy.minVersion,
      minSupportedBuild: policy.minBuild,
      currentVersion: context?.appVersion ?? null,
      currentBuild: context?.appBuild ?? null,
      upgradeRequired: true,
      upgradeUrl: policy.upgradeUrl
    }
  }, 426);
}

@Injectable()
export class ClientVersionGuard implements CanActivate {
  canActivate(executionContext: ExecutionContext) {
    const request = executionContext.switchToHttp().getRequest<HttpRequest & Partial<RequestWithContext>>();

    if (!isAdminRequest(request)) {
      return true;
    }

    const context = request.context;
    const isAdminWeb = context?.platform === "admin-web";
    const versionOk = Boolean(context?.appVersion) && compareVersion(context?.appVersion ?? "0.0.0", adminWebPolicy.minVersion) >= 0;
    const buildOk = typeof context?.appBuild === "number" && context.appBuild >= adminWebPolicy.minBuild;

    if (!isAdminWeb || !versionOk || !buildOk) {
      throw buildUpgradeError(context, adminWebPolicy);
    }

    return true;
  }
}
