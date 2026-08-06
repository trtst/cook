import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AdminAuthGuard } from "../common/admin-auth.guard";
import { ClientVersionGuard } from "../common/client-version.guard";
import { LoginRateLimitGuard } from "../common/login-rate-limit.guard";
import { CoreModule } from "../common/core.module";
import { RequestContextMiddleware } from "../common/request-context.middleware";
import { AdminModule } from "./admin/admin.module";
import { AppConfigModule } from "./app-config/app-config.module";
import { AuthModule } from "./auth/auth.module";
import { DiningGroupModule } from "./dining-group/dining-group.module";
import { EntitlementModule } from "./entitlement/entitlement.module";
import { HomeModule } from "./home/home.module";
import { MealModule } from "./meal/meal.module";
import { PantryModule } from "./pantry/pantry.module";
import { RecipeModule } from "./recipe/recipe.module";
import { UploadModule } from "./upload/upload.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [CoreModule, AdminModule, AppConfigModule, AuthModule, DiningGroupModule, EntitlementModule, HomeModule, RecipeModule, UploadModule, MealModule, PantryModule, UserModule],
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
