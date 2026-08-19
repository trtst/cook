import { Module } from "@nestjs/common";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { UserModule } from "../user/user.module";
import { AdminController } from "../auth/admin.controller";
import { AdminMembershipCodeController } from "./admin-membership-code.controller";
import { AdminMembershipCodeService } from "./admin-membership-code.service";
import { AdminDashboardController } from "./admin-dashboard.controller";
import { AdminDashboardService } from "./admin-dashboard.service";
import { AdminRecipeImageController, AdminRecipeImagePublicController } from "./admin-recipe-image.controller";
import { AdminRecipeImageService } from "./admin-recipe-image.service";
import { AdminSiteContentController, SiteContentController, SiteContentImagePublicController } from "./admin-site-content.controller";
import { AdminSiteContentService } from "./admin-site-content.service";
import { AdminService } from "./admin.service";
import { IngredientImageService } from "./ingredient-image.service";
import { SiteContentImageService } from "./site-content-image.service";

@Module({
  imports: [EntitlementModule, UserModule],
  controllers: [
    AdminController,
    AdminDashboardController,
    AdminMembershipCodeController,
    AdminSiteContentController,
    SiteContentController,
    SiteContentImagePublicController,
    AdminRecipeImageController,
    AdminRecipeImagePublicController
  ],
  providers: [
    AdminService,
    AdminDashboardService,
    AdminMembershipCodeService,
    AdminSiteContentService,
    IngredientImageService,
    SiteContentImageService,
    AdminRecipeImageService,
    SuperAdminGuard
  ],
  exports: [IngredientImageService, AdminRecipeImageService]
})
export class AdminModule {}
