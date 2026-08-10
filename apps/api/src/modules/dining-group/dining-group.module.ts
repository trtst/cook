import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { UploadModule } from "../upload/upload.module";
import { DiningGroupController } from "./dining-group.controller";
import { DiningGroupService } from "./dining-group.service";

@Module({
  imports: [EntitlementModule, UploadModule],
  controllers: [DiningGroupController],
  providers: [DiningGroupService]
})
export class DiningGroupModule {}
