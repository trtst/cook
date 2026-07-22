import { defineStore } from "pinia";
import type {
  CreateInviteResult,
  DiningGroupMemberSummary,
  GetCurrentDiningGroupContextResponse,
  CurrentOriginalSpaceSummary,
  CurrentSpaceSummary,
  EffectiveEntitlementSnapshot
} from "@/apis/dining-group";
import { diningGroupApi } from "@/apis/dining-group";
import type { UUID } from "@/apis/http";
import { createOperationId } from "@/utils/operation-id";
import { onSessionCleared } from "@/utils/session-events";

let refreshCurrentPromise: Promise<GetCurrentDiningGroupContextResponse> | null = null;

export const useDiningGroupStore = defineStore("dining-group", {
  state: () => ({
    currentSpace: null as CurrentSpaceSummary | null,
    currentEntitlements: null as EffectiveEntitlementSnapshot | null,
    originalSpace: null as CurrentOriginalSpaceSummary | null,
    members: [] as DiningGroupMemberSummary[]
  }),
  getters: {
    currentDiningGroup: (state) => state.currentSpace,
    currentDiningGroupId: (state) => state.currentSpace?.id ?? "",
    hasCurrentContext: (state) => Boolean(state.currentSpace && state.currentEntitlements)
  },
  actions: {
    async refreshCurrent() {
      refreshCurrentPromise ??= diningGroupApi.getCurrent().finally(() => {
        refreshCurrentPromise = null;
      });

      const result = await refreshCurrentPromise;
      this.currentSpace = result.currentSpace;
      this.currentEntitlements = result.entitlements;
      this.originalSpace = result.originalSpace;
      return result;
    },
    async createInvite(diningGroupId: UUID, operationId: UUID = createOperationId()): Promise<CreateInviteResult> {
      return diningGroupApi.createInvite({ diningGroupId, operationId });
    },
    async refreshMembers(diningGroupId?: UUID) {
      const targetDiningGroupId = diningGroupId || this.currentDiningGroupId;
      if (!targetDiningGroupId) return null;

      const result = await diningGroupApi.listMembers(targetDiningGroupId);
      this.members = result.members;
      return result;
    },
    async acceptInvite(inviteToken: string, operationId: UUID = createOperationId()) {
      const result = await diningGroupApi.acceptInvite(inviteToken, { operationId });
      await this.refreshCurrent();
      this.members = [];
      return result;
    },
    async leaveCurrent(operationId: UUID = createOperationId()) {
      const diningGroupId = this.currentDiningGroupId;
      if (!diningGroupId) return null;

      const result = await diningGroupApi.leave(diningGroupId, { operationId });
      await this.refreshCurrent();
      this.members = [];
      return result;
    },
    clearDiningGroupState() {
      this.currentSpace = null;
      this.currentEntitlements = null;
      this.originalSpace = null;
      this.members = [];
    }
  }
});

onSessionCleared(() => useDiningGroupStore().clearDiningGroupState());
