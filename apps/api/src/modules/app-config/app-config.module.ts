import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { UserModule } from "../user/user.module";
import { AdminAppConfigController } from "./admin-app-config.controller";
import { AppConfigController } from "./app-config.controller";
import { AppConfigService } from "./app-config.service";
import { PublicAssetsController } from "./public-assets.controller";

@Module({
  imports: [AdminModule, UserModule],
  controllers: [AppConfigController, AdminAppConfigController, PublicAssetsController],
  providers: [AppConfigService],
  exports: [AppConfigService]
})
export class AppConfigModule {}
