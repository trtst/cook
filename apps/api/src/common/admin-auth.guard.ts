import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { RequestWithAdmin } from "./auth-context";
import { PrismaService } from "./prisma.service";
import { AdminTokenService } from "./security/admin-token.service";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject(AdminTokenService) private readonly adminTokenService: AdminTokenService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<HeaderRequest & Partial<RequestWithAdmin>>();
    const token = readBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    const payload = this.adminTokenService.verifyToken(token);
    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: payload.sub },
      select: { status: true, roles: true }
    });

    if (!admin || admin.status !== "ACTIVE") {
      throw new UnauthorizedException("未登录或 token 失效");
    }

    request.admin = {
      adminId: payload.sub,
      roles: admin.roles
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
