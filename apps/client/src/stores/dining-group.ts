import { defineStore } from "pinia";
import type {
	CreateInviteResult,
	DiningGroupMemberSummary,
	DiningGroupSummary,
	DiningGroupUsageSummary
} from "@/apis/dining-group";
import { diningGroupApi } from "@/apis/dining-group";
import type { UUID } from "@/apis/http";
import { createOperationId } from "@/utils/operation-id";
import { onSessionCleared } from "@/utils/session-events";

let refreshCurrentPromise: Promise<void> | null = null;

export const useDiningGroupStore = defineStore("dining-group", {
	state: () => ({
		diningGroups: [] as DiningGroupSummary[],
		usage: null as DiningGroupUsageSummary | null,
		members: [] as DiningGroupMemberSummary[],
		selectedDiningGroupId: "" as UUID | ""
	}),
	getters: {
		currentDiningGroup: (state) => state.diningGroups.find(item => item.id === state.selectedDiningGroupId) ?? null,
		currentDiningGroupId: (state): UUID | "" =>
			state.diningGroups.find(item => item.id === state.selectedDiningGroupId)?.id ?? "",
		hasCurrentContext: (state) => Boolean(state.usage),
		currentRelationSummary: (state) => {
			const currentDiningGroup = state.diningGroups.find(item => item.id === state.selectedDiningGroupId);
			if (!currentDiningGroup) return null;

			return {
				id: currentDiningGroup.id,
				name: currentDiningGroup.name,
				myRole: currentDiningGroup.myRole,
				memberCount: currentDiningGroup.memberCount,
				memberLimit: currentDiningGroup.memberLimit,
				state: currentDiningGroup.state
			};
		},
		relationUsage: (state) => state.usage
	},
	actions: {
		async refreshCurrent() {
			refreshCurrentPromise ??= diningGroupApi
				.getMine()
				.then((groupsResult) => {
					this.diningGroups = groupsResult.items;
					this.usage = groupsResult.usage;

					const currentIds = new Set(groupsResult.items.map(item => item.id));
					if (this.selectedDiningGroupId && currentIds.has(this.selectedDiningGroupId)) return;

					const preferred = groupsResult.items.find(item => item.isOwned) ?? groupsResult.items[0] ?? null;
					this.selectedDiningGroupId = preferred?.id ?? "";
				})
				.finally(() => {
					refreshCurrentPromise = null;
				});

			await refreshCurrentPromise;
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
			this.selectedDiningGroupId = result.diningGroup.id;
			this.members = [];
			return result;
		},
		async leaveCurrent(operationId: UUID = createOperationId()) {
			const diningGroupId = this.currentDiningGroupId;
			const currentDiningGroup = this.currentDiningGroup;
			if (!diningGroupId || !currentDiningGroup) return null;

			const result = await diningGroupApi.leave(diningGroupId, {
				operationId,
				expectedVersion: currentDiningGroup.version
			});
			await this.refreshCurrent();
			this.members = [];
			return result;
		},
		selectDiningGroup(diningGroupId: UUID) {
			this.selectedDiningGroupId = diningGroupId;
		},
		clearDiningGroupState() {
			this.diningGroups = [];
			this.usage = null;
			this.members = [];
			this.selectedDiningGroupId = "";
		}
	}
});

onSessionCleared(() => useDiningGroupStore().clearDiningGroupState());
