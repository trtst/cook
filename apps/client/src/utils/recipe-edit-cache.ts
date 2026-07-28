import { APP_STORAGE_KEYS, uniPlatform } from "@/platform/uni";

const RECIPE_EDIT_CACHE_KEY_PREFIX = `${APP_STORAGE_KEYS.recipeEdit("")}`;

function recipeEditCachePrefix(uid: number | string) {
	return `${APP_STORAGE_KEYS.recipeEdit(uid)}:`;
}

function recipeEditCacheItemKey(uid: number | string, itemKey: string) {
	return `${recipeEditCachePrefix(uid)}${itemKey.trim()}`;
}

export function readRecipeEditCacheItem<T>(uid: number | string, itemKey: string) {
	const normalizedKey = itemKey.trim();
	if (!normalizedKey) return null;
	return uniPlatform.storage.getSync<T>(recipeEditCacheItemKey(uid, normalizedKey));
}

export function writeRecipeEditCacheItem<T>(uid: number | string, itemKey: string, value: T) {
	const normalizedKey = itemKey.trim();
	if (!normalizedKey) return;
	uniPlatform.storage.setSync(recipeEditCacheItemKey(uid, normalizedKey), value);
}

export function removeRecipeEditCacheItem(uid: number | string, itemKey: string) {
	const normalizedKey = itemKey.trim();
	if (!normalizedKey) return;
	uniPlatform.storage.removeSync(recipeEditCacheItemKey(uid, normalizedKey));
}

export function clearRecipeEditCacheStore(uid: number | string) {
	const prefix = recipeEditCachePrefix(uid);
	const legacyKey = APP_STORAGE_KEYS.recipeEdit(uid);
	uniPlatform.storage.keysSync().forEach((key) => {
		if (key === legacyKey || key.startsWith(prefix)) {
			uniPlatform.storage.removeSync(key);
		}
	});
}

export function clearAllRecipeEditCacheStores() {
	uniPlatform.storage.keysSync().forEach((key) => {
		if (!key.startsWith(RECIPE_EDIT_CACHE_KEY_PREFIX)) return;
		uniPlatform.storage.removeSync(key);
	});
}
