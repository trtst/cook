import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { MealController } from "./meal.controller";
import { MealService } from "./meal.service";

@Module({
  imports: [EntitlementModule],
  controllers: [MealController],
  providers: [MealService],
  exports: [MealService]
})
export class MealModule {}
