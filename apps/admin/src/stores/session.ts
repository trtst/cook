import { defineStore } from "pinia";
import type { AdminLoginResult } from "@/apis/auth";
import { adminAppConfig } from "@/apis/config";

const adminSessionMetaKey = `${adminAppConfig.adminTokenStorageKey}_meta`;

interface AdminSessionState {
  token: string | null;
  expiresAt: string | null;
  admin: AdminLoginResult["admin"] | null;
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return true;

  const expiresTime = Date.parse(expiresAt);
  return Number.isNaN(expiresTime) || expiresTime <= Date.now();
}

function clearStoredSession() {
  localStorage.removeItem(adminAppConfig.adminTokenStorageKey);
  localStorage.removeItem(adminSessionMetaKey);
}

function readStoredSession(): AdminSessionState {
  const token = localStorage.getItem(adminAppConfig.adminTokenStorageKey);
  const metaText = localStorage.getItem(adminSessionMetaKey);

  if (!token || !metaText) {
    clearStoredSession();
    return { token: null, expiresAt: null, admin: null };
  }

  try {
    const meta = JSON.parse(metaText) as Pick<AdminSessionState, "expiresAt" | "admin">;
    if (isExpired(meta.expiresAt)) {
      clearStoredSession();
      return { token: null, expiresAt: null, admin: null };
    }

    return {
      token,
      expiresAt: meta.expiresAt,
      admin: meta.admin
    };
  } catch {
    clearStoredSession();
    return { token: null, expiresAt: null, admin: null };
  }
}

export const useSessionStore = defineStore("admin-session", {
  state: (): AdminSessionState => readStoredSession(),
  getters: {
    isLoggedIn: state => Boolean(state.token) && !isExpired(state.expiresAt)
  },
  actions: {
    setSession(result: AdminLoginResult) {
      this.token = result.token;
      this.expiresAt = result.expiresAt;
      this.admin = result.admin;
      localStorage.setItem(adminAppConfig.adminTokenStorageKey, result.token);
      localStorage.setItem(
        adminSessionMetaKey,
        JSON.stringify({
          expiresAt: result.expiresAt,
          admin: result.admin
        })
      );
    },
    clearSession() {
      this.token = null;
      this.expiresAt = null;
      this.admin = null;
      clearStoredSession();
    }
  }
});
