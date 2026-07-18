import { defineStore } from "pinia";

export const useAppStore = defineStore("app", {
  state: () => ({
    bootstrapped: false,
    platform: "mp-weixin"
  }),
  actions: {
    markBootstrapped() {
      this.bootstrapped = true;
    }
  }
});
