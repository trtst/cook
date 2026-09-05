import { Module } from "@nestjs/common";
import { AssetStorageService } from "../../common/asset-storage.service";
import { AdminModule } from "../admin/admin.module";
import { UserModule } from "../user/user.module";
import { AdminAppConfigController } from "./admin-app-config.controller";
import { AppConfigController } from "./app-config.controller";
import { AppConfigService } from "./app-config.service";
import { PublicAssetsController } from "./public-assets.controller";

@Module({
  imports: [AdminModule, UserModule],
  controllers: [AppConfigController, AdminAppConfigController, PublicAssetsController],
  providers: [AssetStorageService, AppConfigService],
  exports: [AppConfigService]
})
export class AppConfigModule {}
