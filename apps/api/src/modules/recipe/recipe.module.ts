import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { RecipeController } from "./recipe.controller";
import { RecipeService } from "./recipe.service";

@Module({
  imports: [EntitlementModule, AdminModule],
  controllers: [RecipeController],
  providers: [RecipeService],
  exports: [RecipeService]
})
export class RecipeModule {}
