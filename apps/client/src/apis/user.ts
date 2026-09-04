/**
 * 用户域接口与用户侧 DTO 定义。
 *
 * 这里把用户相关的读写接口和页面直接依赖的响应结构放在一起，
 * 目的是让页面只理解“用户业务对象”，不需要再回到请求层关心域名和 method。
 */
import { cfg } from "@/config";
import { get, post, put, uploadFile, type IsoDateTime, type OperationId, type PageResult } from "./http";

export interface SessionUser {
	uid: number;
	nickname: string | null;
	avatarUrl: string | null;
}

export interface UserDisplay {
	profileBackgroundUrl: string | null;
	homeBackgroundUrl: string | null;
	canUseProfileBackground: boolean;
	canUseHomeBackground: boolean;
}

export interface UserMembership {
	tier: "FREE" | "PLUS" | "PRO" | "ULTRA";
	validUntil: IsoDateTime | null;
}

export type UserGender = "MALE" | "FEMALE" | "UNSPECIFIED";

export interface CurrentUserProfile {
	cookNo: string | null;
	bio: string | null;
	gender: UserGender | null;
	birthDate: string | null;
}

export interface MeResponse {
	avatarUrl: string | null;
	profile: CurrentUserProfile;
	hasPassword: boolean;
	display: UserDisplay;
	membership: UserMembership;
}

export interface NotificationMealTimes {
	breakfast: string;
	lunch: string;
	afternoonTea: string;
	dinner: string;
	lateNight: string;
}

export interface NotificationSettingsResponse {
	reminderDotOnly: boolean;
	meal: {
		enabled: boolean;
		times: NotificationMealTimes;
	};
	fridge: {
		enabled: boolean;
		days: 1 | 2 | 3 | 5 | 7;
	};
	recommend: {
		enabled: boolean;
	};
}

export interface NotificationBadgeResponse {
	unreadCount: number;
	reminderUnreadCount: number;
	showReminderDot: boolean;
	latestTime: IsoDateTime | "";
}

export type NotificationFeedTypeLabel = "系统审核消息" | "系统清单协作消息" | "系统提醒消息" | "系统官方消息";
export type NotificationFeedTone = "review" | "shopping" | "reminder" | "official";

export interface NotificationFeedItem {
	id: string;
	typeLabel: NotificationFeedTypeLabel;
	tone: NotificationFeedTone;
	title: string;
	desc: string;
	timeValue: IsoDateTime;
	targetPath: string | null;
}

export interface NotificationFeedQuery {
	page?: number;
	pageSize?: number;
}

export type UserSummary = SessionUser;

export interface UpdateCurrentUserRequest {
	nickname?: string;
	cookNo?: string;
	bio?: string | null;
	gender?: UserGender | null;
	birthDate?: string | null;
}

export interface UploadCurrentAvatarRequest {
	filePath: string;
	operationId: OperationId;
}

function isUploadProfileResponse(value: unknown): value is { code: number; message?: string; data: MeResponse } {
	return Boolean(
		value &&
		typeof value === "object" &&
		"code" in value &&
		typeof (value as { code?: unknown }).code === "number" &&
		"data" in value
	);
}

export interface UpdateUserDisplayRequest {
	operationId: string;
	profileBackgroundUrl?: string | null;
	homeBackgroundUrl?: string | null;
}

export interface ChangeCurrentPasswordRequest {
	operationId: OperationId;
	currentPassword?: string;
	newPassword: string;
}

export interface UpdateNotificationSettingsRequest extends NotificationSettingsResponse {}

export interface ChangeCurrentPasswordResult {
	changedAt: IsoDateTime;
}

export interface BindCurrentPhoneRequest {
	operationId: OperationId;
	phone: string;
	code: string;
}

export interface PhoneCodeSendRequest {
	phone: string;
	deviceId: string;
}

export interface NewPhoneCodeSendRequest extends PhoneCodeSendRequest {
	changeToken: string;
}

export interface StartPhoneChangeRequest {
	operationId: OperationId;
	phone: string;
	code: string;
}

export interface StartPhoneChangeResult {
	changeToken: string;
}

export interface CompletePhoneChangeRequest {
	operationId: OperationId;
	changeToken: string;
	phone: string;
	code: string;
}

export interface TasteProfileResponse {
	allergies: string[];
	strictDislikes: string[];
	dislikedIngredients: string[];
	flavorPreferences: string[];
	note: string | null;
	updatedAt: IsoDateTime;
}

export interface UpdateTasteProfileRequest {
	allergies: string[];
	strictDislikes: string[];
	dislikedIngredients: string[];
	flavorPreferences: string[];
	note: string | null;
}

export const userApi = {
	/**
	 * 当前用户信息是登录后全局状态的基础来源。
	 * 统一经由这里请求，避免页面各自复制 `/users/me` 路径。
	 */
	getCurrent() {
		return get<MeResponse>(`${cfg.domain}/api/users/me`);
	},
	getNotificationSettings() {
		return get<NotificationSettingsResponse>(`${cfg.domain}/api/users/me/notification-settings`);
	},
	updateNotificationSettings(body: UpdateNotificationSettingsRequest) {
		return put<NotificationSettingsResponse>(`${cfg.domain}/api/users/me/notification-settings`, body);
	},
	getNotificationBadge() {
		return get<NotificationBadgeResponse>(`${cfg.domain}/api/users/me/notification-badge`);
	},
	getNotificationFeed(query: NotificationFeedQuery = {}) {
		return get<PageResult<NotificationFeedItem>>(
			`${cfg.domain}/api/users/me/notification-feed`,
			query as Record<string, string | number | boolean | null | undefined>
		);
	},
	markNotificationFeedRead() {
		return put<NotificationBadgeResponse>(`${cfg.domain}/api/users/me/notification-feed-read`);
	},
	/**
	 * 更新当前用户基础资料，不承接背景图、会员或口味资料。
	 */
	updateCurrent(body: UpdateCurrentUserRequest) {
		return put<MeResponse>(`${cfg.domain}/api/users/me`, body);
	},
	async uploadCurrentAvatar(body: UploadCurrentAvatarRequest) {
		const result = await uploadFile({
			url: `${cfg.domain}/api/users/me/avatar`,
			filePath: body.filePath,
			name: "file",
			headers: {
				"Idempotency-Key": body.operationId
			}
		});
		if (!isUploadProfileResponse(result.body)) {
			throw new Error("头像上传响应格式不正确");
		}
		if (result.status < 200 || result.status >= 300 || result.body.code !== 0) {
			throw new Error(result.body.message || "头像上传失败");
		}
		return result.body.data;
	},
	/**
	 * 预留更新我的页和首页背景图设置。
	 * 当前服务端能力未开放，调用方应按 `503` 做“开发中”处理。
	 */
	updateDisplay(body: UpdateUserDisplayRequest) {
		const { operationId, ...payload } = body;
		return put<MeResponse>(`${cfg.domain}/api/users/me/display`, payload, {
			idempotencyKey: operationId
		});
	},
	/**
	 * 修改当前登录用户的密码。
	 * 成功后只返回修改时间，不刷新用户展示资料。
	 */
	changeCurrentPassword(body: ChangeCurrentPasswordRequest) {
		const { operationId, ...payload } = body;
		return put<ChangeCurrentPasswordResult>(`${cfg.domain}/api/users/me/password`, payload, {
			idempotencyKey: operationId
		});
	},
	/**
	 * 绑定当前登录用户手机号。
	 * 前端只提交手机号和验证码，服务端校验通过后回写最新 `/users/me` 资料。
	 */
	bindCurrentPhone(body: BindCurrentPhoneRequest) {
		const { operationId, ...payload } = body;
		return post<MeResponse>(`${cfg.domain}/api/users/me/phone/bind`, payload, {
			idempotencyKey: operationId
		});
	},
	sendCurrentPhoneChangeCode(body: PhoneCodeSendRequest) {
		return post<{ cooldownSeconds: number }>(`${cfg.domain}/api/users/me/phone/change-current-code`, body);
	},
	startPhoneChange(body: StartPhoneChangeRequest) {
		const { operationId, ...payload } = body;
		return post<StartPhoneChangeResult>(`${cfg.domain}/api/users/me/phone/change-start`, payload, {
			idempotencyKey: operationId
		});
	},
	sendNewPhoneChangeCode(body: NewPhoneCodeSendRequest) {
		return post<{ cooldownSeconds: number }>(`${cfg.domain}/api/users/me/phone/change-new-code`, body);
	},
	completePhoneChange(body: CompletePhoneChangeRequest) {
		const { operationId, ...payload } = body;
		return post<MeResponse>(`${cfg.domain}/api/users/me/phone/change-complete`, payload, {
			idempotencyKey: operationId
		});
	},
	/**
	 * 读取当前用户私有口味、安全和忌口资料。
	 * 这些资料不向无关饭搭子成员暴露。
	 */
	getTasteProfile() {
		return get<TasteProfileResponse>(`${cfg.domain}/api/users/me/taste-profile`);
	},
	/**
	 * 口味档案属于用户私有信息。
	 * 这里保持单一写入口，后续如果服务端加版本号或校验规则，改动只需要收口在这一层。
	 */
	updateTasteProfile(body: UpdateTasteProfileRequest) {
		return put<TasteProfileResponse>(`${cfg.domain}/api/users/me/taste-profile`, body);
	}
};
