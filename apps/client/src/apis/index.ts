/**
 * API 聚合导出入口。
 *
 * 这里保持极薄，只负责给业务侧提供稳定 import 路径。
 * 不要在这个文件里新增运行时逻辑，避免把模块初始化顺序复杂化。
 */
export { authApi } from "./auth";
export { diningGroupApi } from "./dining-group";
export { recipeApi } from "./recipe";
export { userApi } from "./user";
