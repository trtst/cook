import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { AdminController } from "../auth/admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [EntitlementModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
