import { Module } from "@nestjs/common";
import { AssetStorageService } from "../../common/asset-storage.service";
import { UploadController, UploadPublicController } from "./upload.controller";
import { UploadService } from "./upload.service";

@Module({
  controllers: [UploadController, UploadPublicController],
  providers: [AssetStorageService, UploadService],
  exports: [UploadService]
})
export class UploadModule {}
