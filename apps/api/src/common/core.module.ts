import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AdminTokenService } from "./security/admin-token.service";
import { UserTokenService } from "./security/user-token.service";

@Global()
@Module({
  providers: [PrismaService, AdminTokenService, UserTokenService],
  exports: [PrismaService, AdminTokenService, UserTokenService]
})
export class CoreModule {}
