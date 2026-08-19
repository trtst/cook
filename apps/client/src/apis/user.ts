/**
 * 用户域接口与用户侧 DTO 定义。
 *
 * 这里把用户相关的读写接口和页面直接依赖的响应结构放在一起，
 * 目的是让页面只理解“用户业务对象”，不需要再回到请求层关心域名和 method。
 */
import { cfg } from "@/config";
import { get, post, put, type IsoDateTime } from "./http";

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

export interface MeResponse extends SessionUser {
	phone: string | null;
	display: UserDisplay;
	membership: UserMembership;
}

export type UserSummary = SessionUser;

export interface UpdateCurrentUserRequest {
	nickname?: string;
	avatarUrl?: string;
}

export interface UpdateUserDisplayRequest {
	operationId: string;
	profileBackgroundUrl?: string | null;
	homeBackgroundUrl?: string | null;
}

export interface ChangeCurrentPasswordRequest {
	currentPassword: string;
	newPassword: string;
}

export interface ChangeCurrentPasswordResult {
	changedAt: IsoDateTime;
}

export interface BindCurrentPhoneRequest {
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
	/**
	 * 更新当前用户基础资料。
	 * 只允许昵称和头像，不承接背景图、会员或口味资料。
	 */
	updateCurrent(body: UpdateCurrentUserRequest) {
		return put<MeResponse>(`${cfg.domain}/api/users/me`, body);
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
		return put<ChangeCurrentPasswordResult>(`${cfg.domain}/api/users/me/password`, body);
	},
	/**
	 * 绑定当前登录用户手机号。
	 * 前端只提交手机号和验证码，服务端校验通过后回写最新 `/users/me` 资料。
	 */
	bindCurrentPhone(body: BindCurrentPhoneRequest) {
		return post<MeResponse>(`${cfg.domain}/api/users/me/phone/bind`, body);
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
