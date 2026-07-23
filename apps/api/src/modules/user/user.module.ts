import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { CurrentUserService } from "./current-user.service";
import { DisplayService } from "./display.service";
import { UserController } from "./user.controller";
import { TasteProfileService } from "./taste-profile.service";

@Module({
  imports: [AuthModule, EntitlementModule],
  controllers: [UserController],
  providers: [CurrentUserService, TasteProfileService, DisplayService]
})
export class UserModule {}
