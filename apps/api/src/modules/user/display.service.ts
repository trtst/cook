import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { MeResponse, OperationId, UUID } from "../../contracts/types";

@Injectable()
export class DisplayService {
  async updateCurrent(
    _userId: UUID,
    _operationId: OperationId,
    _profileBackgroundUrl?: string | null,
    _homeBackgroundUrl?: string | null
  ): Promise<MeResponse> {
    throw new ServiceUnavailableException("功能开发中，敬请期待");
  }
}
