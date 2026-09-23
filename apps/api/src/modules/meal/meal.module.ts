import { Module } from "@nestjs/common";
import { CookAssistantModule } from "../cook-assistant/cook-assistant.module";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { UploadModule } from "../upload/upload.module";
import { UserModule } from "../user/user.module";
import { WechatModule } from "../wechat/wechat.module";
import { PantryModule } from "../pantry/pantry.module";
import { MealController } from "./meal.controller";
import { MealService } from "./meal.service";

@Module({
  imports: [CookAssistantModule, EntitlementModule, UploadModule, UserModule, WechatModule, PantryModule],
  controllers: [MealController],
  providers: [MealService],
  exports: [MealService]
})
export class MealModule {}
