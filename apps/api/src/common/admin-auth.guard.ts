import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { RequestWithAdmin } from "./auth-context";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<HeaderRequest & Partial<RequestWithAdmin>>();
    const token = readBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    request.admin = {
      adminId: "00000000-0000-4000-8000-0000000000a1"
    };

    return true;
  }
}

interface HeaderRequest {
  headers: {
    authorization?: string;
  };
}

function readBearerToken(request: HeaderRequest) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}
