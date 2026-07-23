import { cfg } from "@/config";
import { get, post, put, type PageResult, type UUID } from "./http";

export interface FridgeItemSummary {
	id: UUID;
	name: string;
	quantityText: string | null;
	note: string | null;
	available: boolean;
	updatedAt: string;
}

export interface FridgeItemRequest {
	operationId: UUID;
	name: string;
	quantityText?: string | null;
	note?: string | null;
}

export const fridgeApi = {
	/**
	 * 分页读取当前用户自己的冰箱条目。
	 * 冰箱数据始终是个人数据，不因饭搭子关系共享。
	 */
	list(page = 1, pageSize = 50) {
		return get<PageResult<FridgeItemSummary>>(`${cfg.domain}/api/fridge-items`, { page, pageSize });
	},
	/**
	 * 新增当前用户的冰箱条目。
	 * 写入必须携带 `operationId`，用于服务端幂等处理。
	 */
	create(body: FridgeItemRequest) {
		return post<FridgeItemSummary>(`${cfg.domain}/api/fridge-items`, body);
	},
	/**
	 * 更新当前用户已有冰箱条目的名称、数量或备注。
	 * 只作用于指定条目，不批量改购物清单或餐次。
	 */
	update(itemId: UUID, body: FridgeItemRequest) {
		return put<FridgeItemSummary>(`${cfg.domain}/api/fridge-items/${encodeURIComponent(itemId)}`, body);
	},
	/**
	 * 批量标记冰箱条目已消耗。
	 * 用于做饭后扣减可用食材状态。
	 */
	consume(itemIds: UUID[], operationId: UUID) {
		return post<PageResult<FridgeItemSummary>>(`${cfg.domain}/api/fridge-items/consume`, { itemIds, operationId });
	}
};
