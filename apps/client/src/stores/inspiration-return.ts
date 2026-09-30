import { defineStore } from "pinia";

export type RecipeHomeIntent = "my" | "inspiration";
export type InspirationReturnKind = "plan" | "event";

export interface InspirationReturnContext {
	kind: InspirationReturnKind;
	targetUrl: string;
}

export const useInspirationReturnStore = defineStore("inspiration-return", {
	state: () => ({
		context: null as InspirationReturnContext | null,
		pendingTab: null as RecipeHomeIntent | null
	}),
	actions: {
		openFromMeal(targetUrl: string, kind: InspirationReturnKind) {
			this.context = { targetUrl, kind };
			this.pendingTab = "inspiration";
		},
		consumePendingTab() {
			const tab = this.pendingTab;
			this.pendingTab = null;
			return tab;
		},
		clear() {
			this.context = null;
			this.pendingTab = null;
		}
	}
});
