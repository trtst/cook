import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { UploadModule } from "../upload/upload.module";
import { UserModule } from "../user/user.module";
import { MealController } from "./meal.controller";
import { MealService } from "./meal.service";

@Module({
  imports: [EntitlementModule, UploadModule, UserModule],
  controllers: [MealController],
  providers: [MealService],
  exports: [MealService]
})
export class MealModule {}
