import { cfg } from "@/config";
import { get, post, type IsoDateTime, type UUID } from "./http";
import type { DiningEventSummary } from "./meal";
import type { RecipeContentPayload } from "./recipe";

export interface SharePreviewResponse {
	title: string;
	scheduledAt: IsoDateTime;
	location: string | null;
	menu: Pick<RecipeContentPayload, "name" | "ingredients" | "images">;
	organizerUid: number;
}

export const shareApi = {
	/**
	 * 游客或登录用户读取饭局分享预览。
	 * 该接口显式免登录，只返回可公开展示的白名单字段。
	 */
	getPreview(shareToken: string) {
		return get<SharePreviewResponse>(`${cfg.domain}/api/share/${encodeURIComponent(shareToken)}/preview`, undefined, {
			auth: false
		});
	},
	/**
	 * 通过分享 token 接受饭局邀请。
	 * 使用访客姓名加入本次饭局，不建立长期饭搭子关系。
	 */
	acceptInvite(shareToken: string, operationId: UUID, guestName: string) {
		return post<DiningEventSummary>(`${cfg.domain}/api/share/${encodeURIComponent(shareToken)}/accept`, {
			operationId,
			guestName
		});
	}
};
