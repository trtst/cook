import { Module } from "@nestjs/common";
import { UploadController, UploadPublicController } from "./upload.controller";
import { UploadService } from "./upload.service";

@Module({
  controllers: [UploadController, UploadPublicController],
  providers: [UploadService],
  exports: [UploadService]
})
export class UploadModule {}
