import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { RequestWithContext } from "./auth-context";
import { rateLimitService } from "./rate-limit.service";

interface HttpRequest extends Partial<RequestWithContext> {
  path?: string;
}

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const requestContext = request.context;
    const path = request.path ?? "unknown";
    const ip = requestContext?.ip ?? "unknown";

    rateLimitService.assertAllowed({
      key: `login:${ip}:${path}`,
      limit: path.includes("/admin/") ? 10 : 30,
      windowMs: 60_000
    });

    return true;
  }
}
