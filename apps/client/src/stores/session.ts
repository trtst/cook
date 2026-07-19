import { defineStore } from "pinia";
import { uniPlatform } from "@/platform/uni";

const SESSION_STORAGE_KEY = "next_meal_session";

interface SessionSnapshot {
  token: string;
  userId: string;
  expiresAt: string;
  refreshCheckedAt?: number;
}

function isExpired(expiresAt: string) {
  const expiresTime = Date.parse(expiresAt);
  return Number.isNaN(expiresTime) || expiresTime <= Date.now();
}

export const useSessionStore = defineStore("session", {
  state: () => ({
    token: "",
    userId: "",
    expiresAt: "",
    refreshCheckedAt: 0,
    restored: false
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token)
  },
  actions: {
    async restore() {
      const snapshot = await uniPlatform.storage.get<SessionSnapshot>(SESSION_STORAGE_KEY);

      if (snapshot?.token) {
        if (isExpired(snapshot.expiresAt)) {
          await uniPlatform.storage.remove(SESSION_STORAGE_KEY);
          this.restored = true;
          return;
        }

        this.token = snapshot.token;
        this.userId = snapshot.userId;
        this.expiresAt = snapshot.expiresAt;
        this.refreshCheckedAt = snapshot.refreshCheckedAt ?? 0;
      }

      this.restored = true;
    },
    async setSession(snapshot: SessionSnapshot) {
      this.token = snapshot.token;
      this.userId = snapshot.userId;
      this.expiresAt = snapshot.expiresAt;
      this.refreshCheckedAt = snapshot.refreshCheckedAt ?? this.refreshCheckedAt;
      await uniPlatform.storage.set(SESSION_STORAGE_KEY, {
        ...snapshot,
        refreshCheckedAt: this.refreshCheckedAt
      });
    },
    async markRefreshChecked() {
      if (!this.token) return;

      this.refreshCheckedAt = Date.now();
      await uniPlatform.storage.set(SESSION_STORAGE_KEY, {
        token: this.token,
        userId: this.userId,
        expiresAt: this.expiresAt,
        refreshCheckedAt: this.refreshCheckedAt
      });
    },
    async clearSession() {
      this.token = "";
      this.userId = "";
      this.expiresAt = "";
      this.refreshCheckedAt = 0;
      await uniPlatform.storage.remove(SESSION_STORAGE_KEY);
    }
  }
});
