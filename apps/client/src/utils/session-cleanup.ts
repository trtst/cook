import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { emitSessionCleared } from "@/utils/session-events";
import { clearAllRecipeEditCacheStores, clearRecipeEditCacheStore } from "@/utils/recipe-edit-cache";
import { APP_STORAGE_KEYS, uniPlatform } from "@/platform/uni";

export async function clearUserSessionState() {
	const sessionStore = useSessionStore();
	const userStore = useUserStore();
	const currentUid = sessionStore.uid;

	await sessionStore.clearSession();
	userStore.clearProfile();
	if (currentUid > 0) {
		clearRecipeEditCacheStore(currentUid);
	}
	await emitSessionCleared();
}

export function clearLocalClientCache() {
	uniPlatform.storage.removeSync(APP_STORAGE_KEYS.userProfile);
	clearAllRecipeEditCacheStores();
}
