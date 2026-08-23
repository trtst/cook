import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { CurrentUserService } from "./current-user.service";
import { DisplayService } from "./display.service";
import { MedalImageService } from "./medal-image.service";
import { MembershipCodeController } from "./membership-code.controller";
import { MembershipCodeService } from "./membership-code.service";
import { StorageUsageController, UserController } from "./user.controller";
import { MedalService } from "./medal.service";
import { TasteProfileService } from "./taste-profile.service";

@Module({
  imports: [AuthModule, EntitlementModule],
  controllers: [UserController, StorageUsageController, MembershipCodeController],
  providers: [CurrentUserService, TasteProfileService, DisplayService, MedalService, MedalImageService, MembershipCodeService],
  exports: [MedalService, MedalImageService]
})
export class UserModule {}
