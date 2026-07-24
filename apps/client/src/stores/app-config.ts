import { defineStore } from "pinia";
import { appConfigApi } from "@/apis/app-config";

let loadPromise: Promise<void> | null = null;

export const useAppConfigStore = defineStore("app-config", {
	state: () => ({
		loginImageUrl: "" as string,
		loaded: false
	}),
	actions: {
		async load() {
			if (loadPromise) {
				await loadPromise;
				return;
			}

			loadPromise = appConfigApi
				.getPublic()
				.then((config) => {
					this.loginImageUrl = config.login.imageUrl || "";
					this.loaded = true;
				})
				.catch(() => {
					this.loaded = true;
				})
				.finally(() => {
					loadPromise = null;
				});

			await loadPromise;
		}
	}
});
