import { Module } from "@nestjs/common";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { UserModule } from "../user/user.module";
import { AdminController } from "../auth/admin.controller";
import { AdminMembershipCodeController } from "./admin-membership-code.controller";
import { AdminMembershipCodeService } from "./admin-membership-code.service";
import { AdminRecipeImageController, AdminRecipeImagePublicController } from "./admin-recipe-image.controller";
import { AdminRecipeImageService } from "./admin-recipe-image.service";
import { AdminService } from "./admin.service";
import { IngredientImageService } from "./ingredient-image.service";

@Module({
  imports: [EntitlementModule, UserModule],
  controllers: [AdminController, AdminMembershipCodeController, AdminRecipeImageController, AdminRecipeImagePublicController],
  providers: [AdminService, AdminMembershipCodeService, IngredientImageService, AdminRecipeImageService, SuperAdminGuard],
  exports: [IngredientImageService, AdminRecipeImageService]
})
export class AdminModule {}
