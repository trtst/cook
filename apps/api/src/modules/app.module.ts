import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AdminAuthGuard } from "../common/admin-auth.guard";
import { AdminController } from "../modules/auth/admin.controller";
import { AuthController } from "../modules/auth/auth.controller";
import { AuthService } from "../modules/auth/auth.service";
import { DiningGroupController } from "../modules/dining-group/dining-group.controller";
import { DiningGroupService } from "../modules/dining-group/dining-group.service";
import { UserController } from "../modules/user/user.controller";
import { ClientVersionGuard } from "../common/client-version.guard";
import { LoginRateLimitGuard } from "../common/login-rate-limit.guard";
import { PrismaService } from "../common/prisma.service";
import { RequestContextMiddleware } from "../common/request-context.middleware";
import { AdminTokenService } from "../common/security/admin-token.service";
import { UserTokenService } from "../common/security/user-token.service";
import { AdminService } from "./admin/admin.service";

@Module({
  controllers: [AdminController, AuthController, DiningGroupController, UserController],
  providers: [
    AuthService,
    DiningGroupService,
    PrismaService,
    AdminTokenService,
    UserTokenService,
    AdminService,
    AdminAuthGuard,
    LoginRateLimitGuard,
    {
      provide: APP_GUARD,
      useClass: ClientVersionGuard
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes({ path: "{*path}", method: RequestMethod.ALL });
  }
}
