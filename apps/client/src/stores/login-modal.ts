import { defineStore } from "pinia";
import { useAppConfigStore } from "./app-config";
import { uniPlatform } from "@/platform/uni";
import type { AuthSessionResult } from "@/apis/auth";

type LoginModalMode = "wechat" | "phone";

let pendingAction: (() => void) | null = null;

export const useLoginModalStore = defineStore("login-modal", {
	state: () => ({
		visible: false,
		mode: "phone" as LoginModalMode,
		sourceId: null as string | null,
		openImageUrl: "",
		openSeed: 0,
		openedInMiniProgram: false
	}),
	actions: {
		open(sourceId: string | null = null, action: (() => void) | null = null) {
			const isMiniProgram = uniPlatform.system.getRuntimeChannel() === "mini_program";
			const appConfigStore = useAppConfigStore();

			pendingAction = action;
			this.sourceId = sourceId;
			this.openedInMiniProgram = isMiniProgram;
			this.mode = isMiniProgram ? "wechat" : "phone";
			this.openImageUrl = appConfigStore.loginImageUrl;
			this.visible = true;
			this.openSeed += 1;

			if (appConfigStore.loaded) return;

			const currentSeed = this.openSeed;
			void appConfigStore.load().then(() => {
				if (!this.visible || this.openSeed !== currentSeed) return;
				this.openImageUrl = appConfigStore.loginImageUrl;
			});
		},
		openPhoneMode() {
			this.mode = "phone";
		},
		back() {
			if (!this.openedInMiniProgram) {
				this.close();
				return;
			}

			this.mode = "wechat";
		},
		close() {
			this.visible = false;
			this.mode = this.openedInMiniProgram ? "wechat" : "phone";
			this.sourceId = null;
			this.openImageUrl = "";
			this.openedInMiniProgram = false;
			pendingAction = null;
		},
		complete(_session: AuthSessionResult) {
			const result = {
				sourceId: this.sourceId,
				action: pendingAction
			};

			this.visible = false;
			this.mode = this.openedInMiniProgram ? "wechat" : "phone";
			this.sourceId = null;
			this.openImageUrl = "";
			this.openedInMiniProgram = false;
			pendingAction = null;

			return result;
		}
	}
});
