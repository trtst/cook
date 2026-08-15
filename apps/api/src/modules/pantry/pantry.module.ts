import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { PantryController } from "./pantry.controller";
import { PantryService } from "./pantry.service";

@Module({
  imports: [AdminModule, EntitlementModule],
  controllers: [PantryController],
  providers: [PantryService]
})
export class PantryModule {}
