import { defineStore } from "pinia";
import { uniPlatform } from "@/platform/uni";

const SESSION_STORAGE_KEY = "next_meal_session";

interface SessionSnapshot {
  token: string;
  userId: string;
  expiresAt: string;
}

export const useSessionStore = defineStore("session", {
  state: () => ({
    token: "",
    userId: "",
    expiresAt: "",
    restored: false
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token)
  },
  actions: {
    async restore() {
      const snapshot = await uniPlatform.storage.get<SessionSnapshot>(SESSION_STORAGE_KEY);

      if (snapshot?.token) {
        this.token = snapshot.token;
        this.userId = snapshot.userId;
        this.expiresAt = snapshot.expiresAt;
      }

      this.restored = true;
    },
    async setSession(snapshot: SessionSnapshot) {
      this.token = snapshot.token;
      this.userId = snapshot.userId;
      this.expiresAt = snapshot.expiresAt;
      await uniPlatform.storage.set(SESSION_STORAGE_KEY, snapshot);
    },
    async clearSession() {
      this.token = "";
      this.userId = "";
      this.expiresAt = "";
      await uniPlatform.storage.remove(SESSION_STORAGE_KEY);
    }
  }
});
