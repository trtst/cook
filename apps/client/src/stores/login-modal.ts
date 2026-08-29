import { defineStore } from "pinia";
import { useAppConfigStore } from "./app-config";
import { uniPlatform } from "@/platform/uni";
import type { AuthSessionResult } from "@/apis/auth";
import { createLoginActionRegistry, type LoginModalAction } from "./login-modal-actions";

type LoginModalMode = "wechat" | "phone";

const actionRegistry = createLoginActionRegistry();

export const useLoginModalStore = defineStore("login-modal", {
	state: () => ({
		visible: false,
		mode: "phone" as LoginModalMode,
		sourceId: null as string | null,
		actionId: null as string | null,
		openImageUrl: "",
		openSeed: 0,
		openedInMiniProgram: false
	}),
	actions: {
		open(sourceId: string | null = null, action: LoginModalAction = null) {
			const isMiniProgram = uniPlatform.system.getRuntimeChannel() === "mini_program";
			const appConfigStore = useAppConfigStore();

			this.sourceId = sourceId;
			this.actionId = sourceId ? sourceId : actionRegistry.register(action);
			if (sourceId) {
				actionRegistry.set(sourceId, action);
			}
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
			this.actionId = null;
			this.openImageUrl = "";
			this.openedInMiniProgram = false;
			actionRegistry.clear();
		},
		complete(_session: AuthSessionResult) {
			return this.completeForSource(this.sourceId, this.actionId);
		},
		completeForSource(sourceId: string | null, actionId: string | null = sourceId) {
			const result = {
				sourceId,
				action: actionRegistry.take(actionId)
			};

			this.visible = false;
			this.mode = this.openedInMiniProgram ? "wechat" : "phone";
			this.sourceId = null;
			this.actionId = null;
			this.openImageUrl = "";
			this.openedInMiniProgram = false;

			return result;
		}
	}
});
