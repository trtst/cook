import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { DiningGroupController } from "./dining-group.controller";
import { DiningGroupService } from "./dining-group.service";

@Module({
  imports: [EntitlementModule],
  controllers: [DiningGroupController],
  providers: [DiningGroupService]
})
export class DiningGroupModule {}
