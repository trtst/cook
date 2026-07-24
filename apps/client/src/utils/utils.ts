// 这里放跨客户端模块复用的纯函数小工具。
// 只收稳定、无依赖、语义清楚的 helper，不把它做成大杂烩工具箱。
export function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

// 在读取对象字段前，把 unknown 收窄成普通对象。
export function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

// 用在“字段允许是 string 或 null”的接口返回场景里。
export function isMaybeString(value: unknown) {
	return value === null || typeof value === "string";
}
