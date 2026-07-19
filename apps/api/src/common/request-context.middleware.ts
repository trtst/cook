import { Injectable, type NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ClientPlatform, RequestContext, RequestWithContext } from "./auth-context";

type NextFunction = () => void;

interface HeaderRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

function readHeader(request: HeaderRequest, name: string) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function readIp(request: HeaderRequest) {
  const forwardedFor = readHeader(request, "x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  return request.ip ?? request.socket?.remoteAddress ?? "unknown";
}

function parseBuild(value: string | undefined) {
  if (!value) return null;

  const build = Number(value);
  return Number.isInteger(build) && build >= 0 ? build : null;
}

function parsePlatform(value: string | undefined): ClientPlatform {
  if (value === "mp-weixin" || value === "h5" || value === "ios" || value === "android" || value === "admin-web") {
    return value;
  }

  return "unknown";
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: HeaderRequest & Partial<RequestWithContext>, _response: unknown, next: NextFunction) {
    const platform = parsePlatform(readHeader(request, "x-platform"));
    const adminVersion = readHeader(request, "x-admin-version");
    const appVersion = readHeader(request, "x-app-version");
    const adminBuild = readHeader(request, "x-admin-build");
    const appBuild = readHeader(request, "x-app-build");

    const context: RequestContext = {
      requestId: readHeader(request, "x-request-id") || randomUUID(),
      ip: readIp(request),
      userAgent: readHeader(request, "user-agent") ?? "",
      platform,
      appVersion: adminVersion ?? appVersion ?? null,
      appBuild: parseBuild(adminBuild ?? appBuild)
    };

    request.context = context;
    next();
  }
}
