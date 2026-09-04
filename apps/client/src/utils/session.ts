import { refreshSessionIfNeeded } from "@/apis/auth";
import { userApi } from "@/apis/user";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { restoreWechatSession } from "./wechat-session";

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

	// 第一步：先从本地恢复登录 session。
	await sessionStore.restore();
	if (!sessionStore.isLoggedIn) {
		await tryRestoreWechatIdentity();
		return;
	}
	await restoreAuthenticatedUser();
}

async function tryRestoreWechatIdentity() {
	const sessionStore = useSessionStore();
	if (sessionStore.logoutExplicit || uniPlatform.system.getRuntimeChannel() !== "mini_program") return;

	try {
		const restored = await restoreWechatSession(sessionStore);
		if (restored) await restoreAuthenticatedUser();
	} catch {
		// 启动静默识别失败时保留 guest，让用户仍可从登录弹窗重试。
	}
}

async function restoreAuthenticatedUser() {
	const sessionStore = useSessionStore();
	const userStore = useUserStore();

	try {
		const restoredProfile =
			sessionStore.uid > 0 && (await userStore.restoreProfile(sessionStore.uid, USER_PROFILE_CACHE_MS));

		if (!restoredProfile) {
			const profile = await userApi.getCurrent();
			if (sessionStore.uid !== profile.uid) {
				await sessionStore.setSession({
					accessToken: sessionStore.accessToken,
					uid: profile.uid,
					expiresAt: sessionStore.expiresAt,
					refreshToken: sessionStore.refreshToken,
					refreshExpiresAt: sessionStore.refreshExpiresAt,
					refreshCheckedAt: sessionStore.refreshCheckedAt
				});
			}
			userStore.setProfile(profile);
		}
	} catch {
		userStore.clearProfile();
		return;
	}

	await refreshSessionIfNeeded().catch(() => undefined);
}
