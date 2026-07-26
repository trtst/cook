import { cfg } from "@/config";
import { get, post, type IsoDateTime, type PageResult, type UUID } from "./http";
import type { RecipeContentSnapshot } from "./recipe";

export interface MealPlanSummary {
	id: UUID;
	planDate: string;
	mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
	recipeId: UUID | null;
	recipeVersionId: UUID;
	title: string;
	hasDiningEvent: boolean;
	diningEventId: UUID | null;
	createdAt: IsoDateTime;
}

export interface DiningEventParticipantSummary {
	id: UUID;
	userUid: number | null;
	guestName: string | null;
	sourceType: "DINING_GROUP" | "SHARE";
	status: "INVITED" | "ACCEPTED" | "DECLINED" | "REMOVED";
	bringRecipeId: UUID | null;
	bringRecipeTitle: string | null;
}

export interface DiningEventSummary {
	id: UUID;
	title: string;
	scheduledAt: IsoDateTime;
	location: string | null;
	status: "PLANNED" | "CONFIRMED" | "CANCELLED";
	planItemId: UUID | null;
	diningGroupId: UUID | null;
	menu: RecipeContentSnapshot;
	participants: DiningEventParticipantSummary[];
	shareTokenPath: string | null;
	createdAt: IsoDateTime;
}

export interface MealPlanQuery {
	page?: number;
	pageSize?: number;
	from?: string;
	to?: string;
}

export interface CreateMealPlanRequest {
	operationId: UUID;
	planDate: string;
	mealSlot: "BREAKFAST" | "LUNCH" | "DINNER";
	recipeId: UUID;
	note?: string | null;
}

export interface CreateDiningEventRequest {
	operationId: UUID;
	scheduledAt: string;
	location?: string | null;
}

export const mealApi = {
	/**
	 * 分页读取当前用户的个人餐次计划。
	 * 可按日期范围筛选，不读取饭搭子长期共享计划。
	 */
	listPlans(query: MealPlanQuery) {
		return get<PageResult<MealPlanSummary>>(`${cfg.domain}/api/meal-plans`, { ...query });
	},
	/**
	 * 基于当前用户菜谱创建个人餐次计划。
	 * 计划项固定引用服务端确认的菜谱内容版本。
	 */
	createPlan(body: CreateMealPlanRequest) {
		return post<MealPlanSummary>(`${cfg.domain}/api/meal-plans`, body);
	},
	/**
	 * 从餐次计划创建饭局。
	 * 饭局用于邀请参与者、确认菜单和处理带菜协作。
	 */
	createDiningEvent(planItemId: UUID, body: CreateDiningEventRequest) {
		return post<DiningEventSummary>(`${cfg.domain}/api/meal-plans/${encodeURIComponent(planItemId)}/dining-event`, body);
	},
	/**
	 * 读取单个饭局详情。
	 * 返回菜单、参与者、分享入口和当前饭局状态。
	 */
	getDiningEvent(eventId: UUID) {
		return get<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}`);
	},
	/**
	 * 邀请指定饭搭子关系成员参与饭局。
	 * 只创建本次饭局参与关系，不改变长期饭搭子成员关系。
	 */
	inviteDiningGroup(eventId: UUID, diningGroupId: UUID, operationId: UUID) {
		return post<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/invite-group`, {
			diningGroupId,
			operationId
		});
	},
	/**
	 * 当前用户响应饭局邀请。
	 * 只允许接受或拒绝本次饭局参与。
	 */
	respondToDiningEvent(eventId: UUID, operationId: UUID, status: "ACCEPTED" | "DECLINED") {
		return post<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/respond`, {
			operationId,
			status
		});
	},
	/**
	 * 为本次饭局选择自己要带的菜谱。
	 * 带菜选择只影响饭局参与记录，不修改原菜谱。
	 */
	chooseBringRecipe(eventId: UUID, recipeId: UUID, operationId: UUID) {
		return post<DiningEventSummary>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/bring`, {
			recipeId,
			operationId
		});
	}
};
