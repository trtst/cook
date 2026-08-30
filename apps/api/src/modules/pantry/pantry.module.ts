import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { PantryController } from "./pantry.controller";
import { PantryService } from "./pantry.service";
import { WechatModule } from "../wechat/wechat.module";

@Module({
  imports: [AdminModule, EntitlementModule, WechatModule],
  controllers: [PantryController],
  providers: [PantryService],
  exports: [PantryService]
})
export class PantryModule {}
