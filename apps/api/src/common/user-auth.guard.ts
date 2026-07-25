import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { RequestWithUser } from "./auth-context";
import { PrismaService } from "./prisma.service";
import { UserTokenService } from "./security/user-token.service";

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(
    @Inject(UserTokenService) private readonly userTokenService: UserTokenService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<HeaderRequest & Partial<RequestWithUser>>();
    const token = readBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    const payload = this.userTokenService.verifyToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, sessionVersion: true }
    });

    if (!user || user.status !== "ACTIVE" || user.sessionVersion !== payload.ver) {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    request.user = {
      userId: payload.sub
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
