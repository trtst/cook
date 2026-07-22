import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AdminAuthGuard } from "../common/admin-auth.guard";
import { ClientVersionGuard } from "../common/client-version.guard";
import { LoginRateLimitGuard } from "../common/login-rate-limit.guard";
import { CoreModule } from "../common/core.module";
import { RequestContextMiddleware } from "../common/request-context.middleware";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { DiningGroupModule } from "./dining-group/dining-group.module";
import { EntitlementModule } from "./entitlement/entitlement.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [CoreModule, AdminModule, AuthModule, DiningGroupModule, EntitlementModule, UserModule],
  providers: [
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
