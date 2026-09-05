import { Module } from "@nestjs/common";
import { AssetStorageService } from "../../common/asset-storage.service";
import { SuperAdminGuard } from "../../common/super-admin.guard";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { UserModule } from "../user/user.module";
import { AdminController } from "../auth/admin.controller";
import { AdminMembershipCodeController } from "./admin-membership-code.controller";
import { AdminMembershipCodeService } from "./admin-membership-code.service";
import { AdminMaterialImageController, AdminMaterialImagePublicController } from "./admin-material-image.controller";
import { AdminMaterialImageService } from "./admin-material-image.service";
import { AdminDashboardController } from "./admin-dashboard.controller";
import { AdminDashboardService } from "./admin-dashboard.service";
import { AdminRecipeImageController, AdminRecipeImagePublicController } from "./admin-recipe-image.controller";
import { AdminRecipeImageService } from "./admin-recipe-image.service";
import {
  AdminSiteContentController,
  SiteContentArticleController,
  SiteContentController,
  SiteContentImagePublicController,
  SiteOfficialMessageController
} from "./admin-site-content.controller";
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
    AdminMaterialImageController,
    AdminMaterialImagePublicController,
    AdminSiteContentController,
    SiteContentController,
    SiteContentArticleController,
    SiteOfficialMessageController,
    SiteContentImagePublicController,
    AdminRecipeImageController,
    AdminRecipeImagePublicController
  ],
  providers: [
    AdminService,
    AdminDashboardService,
    AdminMembershipCodeService,
    AdminMaterialImageService,
    AdminSiteContentService,
    AssetStorageService,
    IngredientImageService,
    SiteContentImageService,
    AdminRecipeImageService,
    SuperAdminGuard
  ],
  exports: [IngredientImageService, AdminRecipeImageService]
})
export class AdminModule {}
