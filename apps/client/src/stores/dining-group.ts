import { defineStore } from "pinia";
import type {
  CreateDiningGroupResult,
  CreateInviteResult,
  DiningGroupMemberSummary,
  DiningGroupSummary,
  UUID
} from "@next-meal/api-client";
import { diningGroupApi } from "@/apis/dining-group";
import {
  clearCurrentDiningGroupPreference,
  getCurrentDiningGroupPreference,
  setCurrentDiningGroupPreference
} from "@/stores/dining-group-preference";
import { createOperationId } from "@/utils/operation-id";
import { onSessionCleared } from "@/utils/session-events";

function upsertDiningGroup(diningGroups: DiningGroupSummary[], diningGroup: DiningGroupSummary) {
  const index = diningGroups.findIndex((item) => item.id === diningGroup.id);

  if (index >= 0) {
    diningGroups.splice(index, 1, diningGroup);
    return;
  }

  diningGroups.unshift(diningGroup);
}

function resolveCurrentDiningGroupId(
  diningGroups: DiningGroupSummary[],
  preferredDiningGroupId: UUID | null | undefined,
  fallbackDiningGroupId: UUID | null
) {
  if (preferredDiningGroupId && diningGroups.some((item) => item.id === preferredDiningGroupId)) {
    return preferredDiningGroupId;
  }

  if (fallbackDiningGroupId && diningGroups.some((item) => item.id === fallbackDiningGroupId)) {
    return fallbackDiningGroupId;
  }

  return diningGroups[0]?.id ?? "";
}

export const useDiningGroupStore = defineStore("dining-group", {
  state: () => ({
    currentDiningGroupId: "" as UUID | "",
    diningGroups: [] as DiningGroupSummary[],
    membersByDiningGroupId: {} as Record<UUID, DiningGroupMemberSummary[]>
  }),
  getters: {
    currentDiningGroup: (state) => state.diningGroups.find((item) => item.id === state.currentDiningGroupId) ?? null
  },
  actions: {
    setDiningGroups(
      diningGroups: DiningGroupSummary[],
      currentDiningGroupId: UUID | null,
      preferredDiningGroupId?: UUID | null
    ) {
      this.diningGroups = diningGroups;
      this.currentDiningGroupId = resolveCurrentDiningGroupId(diningGroups, preferredDiningGroupId, currentDiningGroupId);
    },
    async refreshMine() {
      const result = await diningGroupApi.listMine();
      const preferredDiningGroupId = await getCurrentDiningGroupPreference();
      this.setDiningGroups(result.diningGroups, result.currentDiningGroupId, preferredDiningGroupId);

      if (this.currentDiningGroupId) {
        await setCurrentDiningGroupPreference(this.currentDiningGroupId);
      } else {
        await clearCurrentDiningGroupPreference();
      }

      return result;
    },
    async createDiningGroup(name: string, operationId: UUID = createOperationId()): Promise<CreateDiningGroupResult> {
      const result = await diningGroupApi.create({
        name,
        operationId
      });

      upsertDiningGroup(this.diningGroups, result.diningGroup);
      await this.setCurrentDiningGroup(result.diningGroup.id);
      return result;
    },
    async createInvite(diningGroupId: UUID, operationId: UUID = createOperationId()): Promise<CreateInviteResult> {
      return diningGroupApi.createInvite({
        diningGroupId,
        operationId
      });
    },
    async refreshMembers(diningGroupId: UUID) {
      const result = await diningGroupApi.listMembers(diningGroupId);
      this.membersByDiningGroupId[diningGroupId] = result.members;
      return result;
    },
    async acceptInvite(inviteToken: string, operationId: UUID = createOperationId()) {
      const result = await diningGroupApi.acceptInvite(inviteToken, {
        operationId
      });

      upsertDiningGroup(this.diningGroups, result.diningGroup);
      await this.setCurrentDiningGroup(result.diningGroup.id);
      this.membersByDiningGroupId[result.diningGroup.id] = [];
      return result;
    },
    async setCurrentDiningGroup(diningGroupId: UUID) {
      this.currentDiningGroupId = diningGroupId;
      await setCurrentDiningGroupPreference(diningGroupId);
    },
    async switchDiningGroup(diningGroupId: UUID) {
      await this.setCurrentDiningGroup(diningGroupId);
    },
    async clearDiningGroupState() {
      this.currentDiningGroupId = "";
      this.diningGroups = [];
      this.membersByDiningGroupId = {};
      await clearCurrentDiningGroupPreference();
    }
  }
});

onSessionCleared(() => useDiningGroupStore().clearDiningGroupState());
