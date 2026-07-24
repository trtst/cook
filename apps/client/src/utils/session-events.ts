type SessionClearedHandler = () => Promise<void> | void;

// 会话被清空后，其他模块需要跟着清理本地状态。
// 这里用一个仅存在于当前运行时的小事件集合完成通知，不扩展成全局业务总线。
const sessionClearedHandlers = new Set<SessionClearedHandler>();

// 注册一个“会话清空后”的回调，具体清理逻辑仍由调用方自己负责。
export function onSessionCleared(handler: SessionClearedHandler) {
	sessionClearedHandlers.add(handler);
}

// 在登出或 token 失效后，并行执行所有已注册的清理回调。
export async function emitSessionCleared() {
	await Promise.all(Array.from(sessionClearedHandlers, (handler) => handler()));
}
