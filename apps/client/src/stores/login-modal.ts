import { defineStore } from "pinia";
import { APP_STORAGE_KEYS, uniPlatform } from "@/platform/uni";
import { createLoginActionRegistry, type LoginModalAction } from "./login-modal-actions";

export type LoginModalMode = "wechat" | "phone" | "password";
type LoginMethod = Extract<LoginModalMode, "phone" | "password">;
type LoginMethodHabit = {
	method: Extract<LoginModalMode, "phone" | "password">;
	successCount: number;
	preferredMode: Extract<LoginModalMode, "phone" | "password"> | null;
};

const actionRegistry = createLoginActionRegistry();
const LOGIN_METHOD_PREFERENCE_THRESHOLD = 3;

function readLoginMethodHabit() {
	const snapshot = uniPlatform.storage.getSync<LoginMethodHabit>(APP_STORAGE_KEYS.loginMethodHabit);
	if (!snapshot || (snapshot.method !== "phone" && snapshot.method !== "password")) return null;
	if (snapshot.preferredMode && snapshot.preferredMode !== "phone" && snapshot.preferredMode !== "password") return null;
	return {
		method: snapshot.method,
		successCount: Math.max(0, Number(snapshot.successCount) || 0),
		preferredMode: snapshot.preferredMode ?? null
	};
}

function preferredLoginMode() {
	return readLoginMethodHabit()?.preferredMode ?? "phone";
}

function recordLoginMethod(method: Extract<LoginModalMode, "phone" | "password">) {
	const current = readLoginMethodHabit();
	const successCount = current?.method === method ? current.successCount + 1 : 1;
	const preferredMode = successCount >= LOGIN_METHOD_PREFERENCE_THRESHOLD ? method : current?.preferredMode ?? null;

	uniPlatform.storage.setSync<LoginMethodHabit>(APP_STORAGE_KEYS.loginMethodHabit, {
		method,
		successCount,
		preferredMode
	});
}

export const useLoginModalStore = defineStore("login-modal", {
	state: () => ({
		visible: false,
		mode: "phone" as LoginModalMode,
		sourceId: null as string | null,
		actionId: null as string | null,
		openSeed: 0,
		openedInMiniProgram: false
	}),
	actions: {
		open(sourceId: string | null = null, action: LoginModalAction = null) {
			const isMiniProgram = uniPlatform.system.getRuntimeChannel() === "mini_program";

			this.sourceId = sourceId;
			this.actionId = sourceId ? sourceId : actionRegistry.register(action);
			if (sourceId) {
				actionRegistry.set(sourceId, action);
			}
			this.openedInMiniProgram = isMiniProgram;
			this.mode = preferredLoginMode();
			this.visible = true;
			this.openSeed += 1;
		},
		openPhoneMode() {
			this.mode = "phone";
		},
		openPasswordMode() {
			this.mode = "password";
		},
		recordLoginMethod(method: LoginMethod) {
			recordLoginMethod(method);
		},
		back() {
			if (!this.openedInMiniProgram) {
				this.close();
				return;
			}

			this.mode = "phone";
		},
		close() {
			this.visible = false;
			this.mode = "phone";
			this.sourceId = null;
			this.actionId = null;
			this.openedInMiniProgram = false;
			actionRegistry.clear();
		},
		complete() {
			return this.completeForSource(this.sourceId, this.actionId);
		},
		completeForSource(sourceId: string | null, actionId: string | null = sourceId) {
			const result = {
				sourceId,
				action: actionRegistry.take(actionId)
			};

			this.visible = false;
			this.mode = "phone";
			this.sourceId = null;
			this.actionId = null;
			this.openedInMiniProgram = false;

			return result;
		}
	}
});
