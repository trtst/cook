import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UserController } from "./user.controller";
import { TasteProfileService } from "./taste-profile.service";

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [TasteProfileService]
})
export class UserModule {}
