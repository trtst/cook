import { defineStore } from "pinia";
import { appConfigApi } from "@/apis/app-config";

let loadPromise: Promise<void> | null = null;

export const useAppConfigStore = defineStore("app-config", {
	state: () => ({
		loginImageUrl: "" as string,
		loaded: false,
		homeRefreshPending: false,
		foregroundStarted: false
	}),
	actions: {
		async loadOnLaunch() {
			this.homeRefreshPending = false;
			await this.load();
		},
		startForegroundCycle() {
			if (!this.foregroundStarted) {
				this.foregroundStarted = true;
				return;
			}

			this.homeRefreshPending = true;
		},
		async refreshForHomeShow() {
			if (!this.homeRefreshPending) return;
			this.homeRefreshPending = false;
			await this.load();
		},
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
