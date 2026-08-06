import { Module } from "@nestjs/common";
import { AdminHomeController } from "./admin-home.controller";
import { AdminHomeTopicController } from "./admin-home-topic.controller";
import { HomeController, HomePublicAssetsController } from "./home.controller";
import { HomeImageService } from "./home-image.service";
import { HomeTopicController, HomeTopicPublicAssetsController } from "./home-topic.controller";
import { HomeTopicImageService } from "./home-topic-image.service";
import { HomeTopicService } from "./home-topic.service";
import { HomeService } from "./home.service";

@Module({
  controllers: [
    HomeController,
    HomePublicAssetsController,
    HomeTopicController,
    HomeTopicPublicAssetsController,
    AdminHomeController,
    AdminHomeTopicController
  ],
  providers: [HomeService, HomeImageService, HomeTopicService, HomeTopicImageService],
  exports: [HomeService, HomeTopicService]
})
export class HomeModule {}
