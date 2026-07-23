import { cfg } from "@/config";
import { get, post, type PageResult, type UUID } from "./http";

export interface ShoppingItemSummary {
	id: UUID;
	name: string;
	quantityText: string | null;
	note: string | null;
	sourceType: "MANUAL" | "PLAN" | "EVENT" | "BRING";
	sourceKey: string | null;
	status: "OPEN" | "BOUGHT" | "DELETED";
	updatedAt: string;
}

export interface CreateShoppingItemRequest {
	operationId: UUID;
	name: string;
	quantityText?: string | null;
	note?: string | null;
}

export const shoppingApi = {
	/**
	 * 分页读取当前用户自己的购物清单。
	 * 可按状态过滤待买、已买或已删除条目。
	 */
	list(status?: "OPEN" | "BOUGHT" | "DELETED", page = 1, pageSize = 50) {
		return get<PageResult<ShoppingItemSummary>>(`${cfg.domain}/api/shopping-items`, { status, page, pageSize });
	},
	/**
	 * 手动新增购物条目。
	 * 写入归当前用户所有，不创建饭搭子共享购物清单。
	 */
	create(body: CreateShoppingItemRequest) {
		return post<ShoppingItemSummary>(`${cfg.domain}/api/shopping-items`, body);
	},
	/**
	 * 更新购物条目的状态。
	 * 用于标记待买、已买或删除，具体状态流转由服务端校验。
	 */
	updateStatus(itemId: UUID, operationId: UUID, status: "OPEN" | "BOUGHT" | "DELETED") {
		return post<ShoppingItemSummary>(`${cfg.domain}/api/shopping-items/${encodeURIComponent(itemId)}/status`, {
			operationId,
			status
		});
	},
	/**
	 * 预览指定饭局相对当前用户冰箱的缺口。
	 * 只做计算预览，不落购物清单。
	 */
	previewGap(eventId: UUID) {
		return get<ShoppingItemSummary[]>(`${cfg.domain}/api/shopping-gap`, { eventId });
	},
	/**
	 * 根据饭局缺口生成购物条目。
	 * 生成结果仍归当前用户个人购物清单所有。
	 */
	createEventGap(eventId: UUID, operationId: UUID) {
		return post<ShoppingItemSummary[]>(`${cfg.domain}/api/dining-events/${encodeURIComponent(eventId)}/shopping-gap`, {
			operationId
		});
	}
};
