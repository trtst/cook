import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { CookAssistantModule } from "../cook-assistant/cook-assistant.module";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { UploadModule } from "../upload/upload.module";
import { RecipeController } from "./recipe.controller";
import { RecipeService } from "./recipe.service";

@Module({
  imports: [CookAssistantModule, EntitlementModule, AdminModule, UploadModule],
  controllers: [RecipeController],
  providers: [RecipeService],
  exports: [RecipeService]
})
export class RecipeModule {}
