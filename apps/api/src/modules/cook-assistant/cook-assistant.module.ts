import { Module } from "@nestjs/common";
import { CookAssistantAccessService } from "./cook-assistant-access.service";

@Module({
  providers: [CookAssistantAccessService],
  exports: [CookAssistantAccessService]
})
export class CookAssistantModule {}
