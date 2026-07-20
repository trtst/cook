import { defineStore } from "pinia";
import type {
  CreateInviteResult,
  DiningGroupMemberSummary,
  GetCurrentDiningGroupContextResponse,
  UUID
} from "@next-meal/api-client";
import { diningGroupApi } from "@/apis/dining-group";
import { createOperationId } from "@/utils/operation-id";
import { onSessionCleared } from "@/utils/session-events";

export const useDiningGroupStore = defineStore("dining-group", {
  state: () => ({
    currentContext: null as GetCurrentDiningGroupContextResponse | null,
    members: [] as DiningGroupMemberSummary[]
  }),
  getters: {
    currentDiningGroup: (state) => state.currentContext?.currentSpace ?? null,
    currentDiningGroupId: (state) => state.currentContext?.currentSpace.id ?? "",
    originalSpace: (state) => state.currentContext?.originalSpace ?? null
  },
  actions: {
    async refreshCurrent() {
      const result = await diningGroupApi.getCurrent();
      this.currentContext = result;
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
      this.currentContext = null;
      this.members = [];
    }
  }
});

onSessionCleared(() => useDiningGroupStore().clearDiningGroupState());
