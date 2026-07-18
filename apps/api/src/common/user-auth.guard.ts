import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { RequestWithUser } from "./auth-context";

@Injectable()
export class UserAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<HeaderRequest & Partial<RequestWithUser>>();
    const token = readBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    request.user = {
      userId: "00000000-0000-4000-8000-000000000001"
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
