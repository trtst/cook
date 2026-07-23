import { defineStore } from "pinia";
import { APP_STORAGE_KEYS } from "@/config";
import { uniPlatform } from "@/platform/uni";

interface SessionSnapshot {
  token: string;
  uid?: number;
  userId?: string;
  expiresAt: string;
  refreshCheckedAt?: number;
}

function isExpired(expiresAt: string) {
  const expiresTime = Date.parse(expiresAt);
  return Number.isNaN(expiresTime) || expiresTime <= Date.now();
}

function normalizeUid(uid?: number) {
  return typeof uid === "number" && uid > 0 ? uid : 0;
}

export const useSessionStore = defineStore("session", {
  state: () => ({
    token: "",
    uid: 0,
    expiresAt: "",
    refreshCheckedAt: 0,
    restored: false
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token)
  },
  actions: {
    async restore() {
      const snapshot = await uniPlatform.storage.get<SessionSnapshot>(APP_STORAGE_KEYS.session);

      if (snapshot?.token) {
        if (isExpired(snapshot.expiresAt)) {
          await uniPlatform.storage.remove(APP_STORAGE_KEYS.session);
          this.restored = true;
          return;
        }

        this.token = snapshot.token;
        this.uid = normalizeUid(snapshot.uid);
        this.expiresAt = snapshot.expiresAt;
        this.refreshCheckedAt = snapshot.refreshCheckedAt ?? 0;
      }

      this.restored = true;
    },
    async setSession(snapshot: SessionSnapshot) {
      this.token = snapshot.token;
      this.uid = normalizeUid(snapshot.uid);
      this.expiresAt = snapshot.expiresAt;
      this.refreshCheckedAt = snapshot.refreshCheckedAt ?? this.refreshCheckedAt;
      await uniPlatform.storage.set(APP_STORAGE_KEYS.session, {
        ...snapshot,
        refreshCheckedAt: this.refreshCheckedAt
      });
    },
    async markRefreshChecked() {
      if (!this.token) return;

      this.refreshCheckedAt = Date.now();
      await uniPlatform.storage.set(APP_STORAGE_KEYS.session, {
        token: this.token,
        uid: this.uid,
        expiresAt: this.expiresAt,
        refreshCheckedAt: this.refreshCheckedAt
      });
    },
    async clearSession() {
      this.token = "";
      this.uid = 0;
      this.expiresAt = "";
      this.refreshCheckedAt = 0;
      await uniPlatform.storage.remove(APP_STORAGE_KEYS.session);
    }
  }
});
