import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { UserModule } from "../user/user.module";
import { MealController } from "./meal.controller";
import { MealService } from "./meal.service";

@Module({
  imports: [EntitlementModule, UserModule],
  controllers: [MealController],
  providers: [MealService],
  exports: [MealService]
})
export class MealModule {}
