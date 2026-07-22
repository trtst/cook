/**
 * 用户域接口与用户侧 DTO 定义。
 *
 * 这里把用户相关的读写接口和页面直接依赖的响应结构放在一起，
 * 目的是让页面只理解“用户业务对象”，不需要再回到请求层关心域名和 method。
 */
import { cfg } from "@/config";
import { get, put, type IsoDateTime } from "./http";

export interface UserBasic {
	uid: number;
	nickname: string | null;
	avatarUrl: string | null;
	phone: string | null;
}

export interface UserSummary {
	uid: number;
	nickname: string | null;
	avatarUrl: string | null;
}

export interface UpdateCurrentUserRequest {
	nickname?: string;
	avatarUrl?: string;
}

export interface ChangeCurrentPasswordRequest {
	currentPassword: string;
	newPassword: string;
}

export interface ChangeCurrentPasswordResult {
	changedAt: IsoDateTime;
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
		return get<UserBasic>(`${cfg.domain}/api/users/me`);
	},
	updateCurrent(body: UpdateCurrentUserRequest) {
		return put<UserBasic>(`${cfg.domain}/api/users/me`, body);
	},
	changeCurrentPassword(body: ChangeCurrentPasswordRequest) {
		return put<ChangeCurrentPasswordResult>(`${cfg.domain}/api/users/me/password`, body);
	},
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
