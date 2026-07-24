import { defineStore } from "pinia";

// App store keeps only app-wide boot state.
// It should not absorb page data or business domain state.
export const useAppStore = defineStore("app", {
	state: () => ({
		// Marks that the initial restore path has finished.
		bootstrapped: false,
		// Current client platform marker for mini-program runtime checks.
		platform: "mp-weixin"
	}),
	actions: {
		// Called once when the app bootstrap flow has completed.
		markBootstrapped() {
			this.bootstrapped = true;
		}
	}
});
