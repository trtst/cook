import type { AuthSessionResult } from "@/apis/auth";

type SessionClearedHandler = () => Promise<void> | void;
type LoginSuccessHandler = (payload: LoginSuccessPayload) => Promise<void> | void;

export interface LoginSuccessPayload {
	sourceId: string | null;
	session: AuthSessionResult;
}

// 会话被清空后，其他模块需要跟着清理本地状态。
// 这里用一个仅存在于当前运行时的小事件集合完成通知，不扩展成全局业务总线。
const sessionClearedHandlers = new Set<SessionClearedHandler>();
const loginSuccessHandlers = new Set<LoginSuccessHandler>();

// 注册一个“会话清空后”的回调，具体清理逻辑仍由调用方自己负责。
export function onSessionCleared(handler: SessionClearedHandler) {
	sessionClearedHandlers.add(handler);
	return () => {
		sessionClearedHandlers.delete(handler);
	};
}

// 登录成功后的联动仍保持最小运行时事件，不把页面刷新逻辑塞进请求层或 store。
export function onLoginSuccess(handler: LoginSuccessHandler) {
	loginSuccessHandlers.add(handler);
	return () => {
		loginSuccessHandlers.delete(handler);
	};
}

// 在登出或 token 失效后，并行执行所有已注册的清理回调。
export async function emitSessionCleared() {
	await Promise.all(Array.from(sessionClearedHandlers, (handler) => handler()));
}

export async function emitLoginSuccess(payload: LoginSuccessPayload) {
	await Promise.all(Array.from(loginSuccessHandlers, (handler) => handler(payload)));
}
