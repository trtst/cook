import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { RecipeController } from "./recipe.controller";
import { RecipeService } from "./recipe.service";

@Module({
  imports: [EntitlementModule],
  controllers: [RecipeController],
  providers: [RecipeService],
  exports: [RecipeService]
})
export class RecipeModule {}
