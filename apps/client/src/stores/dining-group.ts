import { defineStore } from "pinia";
import type {
	CreateDiningGroupResponse,
	CreateInviteResult,
	DiningGroupMemberSummary,
	DiningGroupSummary,
	DiningGroupUsageSummary,
	DissolveDiningGroupResponse,
	UpdateDiningGroupCoverResponse,
	UpdateDiningGroupResponse
} from "@/apis/dining-group";
import { diningGroupApi } from "@/apis/dining-group";
import type { OperationId, UUID } from "@/apis/http";
import { createOperationId } from "@/utils/operation-id";
import { onSessionCleared } from "@/utils/session-events";

// Dedupe concurrent "load my dining groups" requests so multiple pages
// do not stampede the same bootstrap API during startup.
let refreshCurrentPromise: Promise<void> | null = null;

// Dining-group store owns only relationship context:
// current list, usage summary, member list, and selected group id.
// It does not own recipe, pantry, or meal data.
export const useDiningGroupStore = defineStore("dining-group", {
	state: () => ({
		// All dining groups visible to the current user.
		diningGroups: [] as DiningGroupSummary[],
		// Server-resolved usage summary for current dining-group relationship limits.
		usage: null as DiningGroupUsageSummary | null,
		// Members of the currently inspected dining group.
		members: [] as DiningGroupMemberSummary[],
		// Current client selection used by pages as relationship context.
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
				description: currentDiningGroup.description,
				myRole: currentDiningGroup.myRole,
				memberCount: currentDiningGroup.memberCount,
				memberLimit: currentDiningGroup.memberLimit,
				state: currentDiningGroup.state
			};
		},
		relationUsage: (state) => state.usage
	},
	actions: {
		// Refreshes the relationship context from the server.
		// Keeps the current selection when possible, otherwise falls back to owned group first.
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
		async createDiningGroup(
			name: string,
			description: string | null,
			operationId: OperationId = createOperationId()
		): Promise<CreateDiningGroupResponse> {
			const result = await diningGroupApi.create({ name, description, operationId });
			await this.refreshCurrent();
			this.selectedDiningGroupId = result.diningGroup.id;
			this.members = [];
			return result;
		},
		// Creates an invite for one dining group.
		// Operation id defaults here so pages can stay focused on their own flow.
		async createInvite(diningGroupId: UUID, operationId: OperationId = createOperationId()): Promise<CreateInviteResult> {
			return diningGroupApi.createInvite({ diningGroupId, operationId });
		},
		// Loads members for the requested group or the currently selected group.
		async refreshMembers(diningGroupId?: UUID) {
			const targetDiningGroupId = diningGroupId || this.currentDiningGroupId;
			if (!targetDiningGroupId) return null;

			const result = await diningGroupApi.listMembers(targetDiningGroupId);
			this.members = result.members;
			return result;
		},
		// Accepts an invite, refreshes relationship context, and points selection to the joined group.
		async acceptInvite(inviteToken: string, operationId: OperationId = createOperationId()) {
			const result = await diningGroupApi.acceptInvite(inviteToken, { operationId });
			await this.refreshCurrent();
			this.selectedDiningGroupId = result.diningGroup.id;
			this.members = [];
			return result;
		},
		async updateCurrentDiningGroup(
			name: string,
			description: string | null,
			operationId: OperationId = createOperationId()
		): Promise<UpdateDiningGroupResponse | null> {
			const currentDiningGroup = this.currentDiningGroup;
			if (!currentDiningGroup) return null;

			const result = await diningGroupApi.update(currentDiningGroup.id, {
				name,
				description,
				expectedVersion: currentDiningGroup.version,
				operationId
			});
			await this.refreshCurrent();
			this.selectedDiningGroupId = result.diningGroup.id;
			return result;
		},
		async updateCurrentDiningGroupCover(
			filePath: string,
			operationId: OperationId = createOperationId()
		): Promise<UpdateDiningGroupCoverResponse | null> {
			const currentDiningGroup = this.currentDiningGroup;
			if (!currentDiningGroup) return null;

			const result = await diningGroupApi.updateCover({
				diningGroupId: currentDiningGroup.id,
				expectedVersion: currentDiningGroup.version,
				filePath,
				operationId
			});
			await this.refreshCurrent();
			this.selectedDiningGroupId = result.diningGroup.id;
			return result;
		},
		// Leaves the currently selected group using optimistic version check from the current summary.
		async leaveCurrent(operationId: OperationId = createOperationId()) {
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
		async dissolveCurrent(operationId: OperationId = createOperationId()): Promise<DissolveDiningGroupResponse | null> {
			const diningGroupId = this.currentDiningGroupId;
			const currentDiningGroup = this.currentDiningGroup;
			if (!diningGroupId || !currentDiningGroup) return null;

			const result = await diningGroupApi.dissolve(diningGroupId, {
				operationId,
				expectedVersion: currentDiningGroup.version
			});
			await this.refreshCurrent();
			this.members = [];
			return result;
		},
		// Pure client-side selection update.
		selectDiningGroup(diningGroupId: UUID) {
			this.selectedDiningGroupId = diningGroupId;
		},
		// Clears all relationship context when login session is no longer valid.
		clearDiningGroupState() {
			this.diningGroups = [];
			this.usage = null;
			this.members = [];
			this.selectedDiningGroupId = "";
		}
	}
});

// Dining-group context becomes invalid as soon as the session is cleared.
onSessionCleared(() => useDiningGroupStore().clearDiningGroupState());
