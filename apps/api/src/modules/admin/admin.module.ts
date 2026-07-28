import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { AdminController } from "../auth/admin.controller";
import { AdminService } from "./admin.service";
import { IngredientImageService } from "./ingredient-image.service";

@Module({
  imports: [EntitlementModule],
  controllers: [AdminController],
  providers: [AdminService, IngredientImageService],
  exports: [IngredientImageService]
})
export class AdminModule {}
