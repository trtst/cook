import type { AdminLoginResult } from "@next-meal/api-client";
import { defineStore } from "pinia";
import { adminAppConfig } from "@/apis/config";

interface AdminSessionState {
  token: string | null;
  expiresAt: string | null;
  admin: AdminLoginResult["admin"] | null;
}

function readStoredToken() {
  return localStorage.getItem(adminAppConfig.adminTokenStorageKey);
}

export const useSessionStore = defineStore("admin-session", {
  state: (): AdminSessionState => ({
    token: readStoredToken(),
    expiresAt: null,
    admin: null
  }),
  getters: {
    isLoggedIn: state => Boolean(state.token)
  },
  actions: {
    setSession(result: AdminLoginResult) {
      this.token = result.token;
      this.expiresAt = result.expiresAt;
      this.admin = result.admin;
      localStorage.setItem(adminAppConfig.adminTokenStorageKey, result.token);
    },
    clearSession() {
      this.token = null;
      this.expiresAt = null;
      this.admin = null;
      localStorage.removeItem(adminAppConfig.adminTokenStorageKey);
    }
  }
});
