import { Module } from "@nestjs/common";
import { EntitlementModule } from "../entitlement/entitlement.module";
import { PantryController } from "./pantry.controller";
import { PantryService } from "./pantry.service";

@Module({
  imports: [EntitlementModule],
  controllers: [PantryController],
  providers: [PantryService]
})
export class PantryModule {}
