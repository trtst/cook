import { refreshSessionIfNeeded } from "@/apis/auth";
import { userApi } from "@/apis/user";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";

// 当前用户资料的本地缓存只保留短时间。
// 登录 token 才是真正的会话事实，资料缓存只是为了减少额外 `/me` 请求。
const USER_PROFILE_CACHE_MS = 10 * 60 * 1000;

// App.vue 启动和页面首次进入都可能触发恢复，这里要去重并发恢复流程。
let restorePromise: Promise<void> | null = null;
let restored = false;

// 每次小程序运行期间只执行一次完整会话恢复：
// session -> 当前用户资料 -> 静默 refresh 检查。
export function restoreAppSession() {
	if (restored) return Promise.resolve();

	restorePromise ??= restoreCurrentUser().finally(() => {
		restored = true;
		restorePromise = null;
	});

	return restorePromise;
}

// 真正的恢复链路放在这里，外层只负责“一次性”和并发去重。
async function restoreCurrentUser() {
	const sessionStore = useSessionStore();
	const userStore = useUserStore();

	// 第一步：先从本地恢复登录 session。
	await sessionStore.restore();
	if (!sessionStore.isLoggedIn) return;

	try {
		// 第二步：如果 uid 还匹配，优先复用短时有效的本地 `/me` 缓存。
		const restoredProfile =
			sessionStore.uid > 0 && (await userStore.restoreProfile(sessionStore.uid, USER_PROFILE_CACHE_MS));

		if (!restoredProfile) {
			// 缓存失效或不存在时，回退到真实 `/me` 请求。
			const profile = await userApi.getCurrent();

			if (sessionStore.uid !== profile.uid) {
				// 服务端返回的 uid 优先于旧的本地 session 快照。
				await sessionStore.setSession({
					token: sessionStore.token,
					uid: profile.uid,
					expiresAt: sessionStore.expiresAt,
					refreshCheckedAt: sessionStore.refreshCheckedAt
				});
			}

			userStore.setProfile(profile);
		}
	} catch {
		// 用户资料恢复失败时，只清理依赖用户的本地状态，不在这里继续扩散异常。
		userStore.clearProfile();
		return;
	}

	// 第三步：在页面已经有可用状态后，再尝试一次静默续期检查。
	await refreshSessionIfNeeded().catch(() => undefined);
}
