import { Module } from "@nestjs/common";
import { AssetStorageService } from "../../common/asset-storage.service";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { WechatModule } from "../wechat/wechat.module";
import { PantryModule } from "../pantry/pantry.module";
import { AdminHomeController } from "./admin-home.controller";
import { AdminHomeTopicController } from "./admin-home-topic.controller";
import { AdminTableTopicController } from "./admin-table-topic.controller";
import { HomeController, HomePublicAssetsController } from "./home.controller";
import { HomeImageService } from "./home-image.service";
import { HomeTopicController, HomeTopicPublicAssetsController } from "./home-topic.controller";
import { HomeTopicImageService } from "./home-topic-image.service";
import { HomeTopicService } from "./home-topic.service";
import { HomeTopicStatsService } from "./home-topic-stats.service";
import { HomeService } from "./home.service";
import { TableTopicController, TableTopicPublicAssetsController } from "./table-topic.controller";
import { TableTopicImageService } from "./table-topic-image.service";
import { TableTopicService } from "./table-topic.service";

@Module({
  imports: [PantryModule, WechatModule],
  controllers: [
    HomeController,
    HomePublicAssetsController,
    HomeTopicController,
    HomeTopicPublicAssetsController,
    TableTopicController,
    TableTopicPublicAssetsController,
    AdminHomeController,
    AdminHomeTopicController,
    AdminTableTopicController
  ],
  providers: [HomeService, AssetStorageService, HomeImageService, HomeTopicService, HomeTopicStatsService, HomeTopicImageService, TableTopicService, TableTopicImageService, SuperAdminGuard],
  exports: [HomeService, HomeTopicService, TableTopicService]
})
export class HomeModule {}
