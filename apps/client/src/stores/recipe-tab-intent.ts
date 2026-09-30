import { defineStore } from "pinia";

export type RecipeHomeIntent = "my" | "inspiration";

export const useRecipeTabIntentStore = defineStore("recipe-tab-intent", {
	state: () => ({
		pendingTab: null as RecipeHomeIntent | null
	}),
	actions: {
		// 只传递一次入口标签意图，不保存饭局或计划页面的返回上下文。
		open(tab: RecipeHomeIntent) {
			this.pendingTab = tab;
		},
		consumePendingTab() {
			const tab = this.pendingTab;
			this.pendingTab = null;
			return tab;
		}
	}
});
