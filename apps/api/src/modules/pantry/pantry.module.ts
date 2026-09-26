import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { PantryController } from "./pantry.controller";
import { PantryService } from "./pantry.service";
import { ShoppingListRetentionService } from "./shopping-list-retention.service";

@Module({
  imports: [AdminModule, EntitlementModule],
  controllers: [PantryController],
  providers: [PantryService, ShoppingListRetentionService],
  exports: [PantryService]
})
export class PantryModule {}
