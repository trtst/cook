import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { RequestWithAdmin } from "./auth-context";
import { AdminTokenService } from "./security/admin-token.service";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(@Inject(AdminTokenService) private readonly adminTokenService: AdminTokenService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<HeaderRequest & Partial<RequestWithAdmin>>();
    const token = readBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    const payload = this.adminTokenService.verifyToken(token);

    request.admin = {
      adminId: payload.sub,
      roles: payload.roles
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
