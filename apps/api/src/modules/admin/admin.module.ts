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
import { AdminRecipeImageController } from "./admin-recipe-image.controller";
import { AdminRecipeImageService } from "./admin-recipe-image.service";
import { AdminImageGenerationController } from "./admin-image-generation.controller";
import { AdminImageGenerationService } from "./admin-image-generation.service";
import { ArkImageGenerationProvider, IMAGE_GENERATION_PROVIDERS, VolcengineVisualImageGenerationProvider, type ImageGenerationProviderMap } from "./image-generation-provider";
import {
  AdminSiteContentController,
  SiteContentArticleController,
  SiteContentController,
  SiteContentImagePublicController,
  SiteOfficialMessageController
} from "./admin-site-content.controller";
import { AdminSiteContentService } from "./admin-site-content.service";
import { AdminService } from "./admin.service";
import { AdminIngredientImportController } from "./admin-ingredient-import.controller";
import { AdminIngredientImportService } from "./admin-ingredient-import.service";
import { AdminSystemDataController } from "./admin-system-data.controller";
import { AdminSystemDataService } from "./admin-system-data.service";
import { IngredientImageService } from "./ingredient-image.service";
import { SiteContentImageService } from "./site-content-image.service";

@Module({
  imports: [EntitlementModule, UserModule],
  controllers: [
    AdminController,
    AdminIngredientImportController,
    AdminSystemDataController,
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
    AdminImageGenerationController
  ],
  providers: [
    AdminService,
    AdminIngredientImportService,
    AdminSystemDataService,
    AdminDashboardService,
    AdminMembershipCodeService,
    AdminMaterialImageService,
    AdminSiteContentService,
    AssetStorageService,
    IngredientImageService,
    SiteContentImageService,
    AdminRecipeImageService,
    AdminImageGenerationService,
    ArkImageGenerationProvider,
    VolcengineVisualImageGenerationProvider,
    {
      provide: IMAGE_GENERATION_PROVIDERS,
      useFactory: (ark: ArkImageGenerationProvider, visual: VolcengineVisualImageGenerationProvider): ImageGenerationProviderMap => ({
        ARK_SEEDREAM: ark,
        VOLCENGINE_CV: visual
      }),
      inject: [ArkImageGenerationProvider, VolcengineVisualImageGenerationProvider]
    },
    SuperAdminGuard
  ],
  exports: [IngredientImageService, AdminRecipeImageService]
})
export class AdminModule {}
