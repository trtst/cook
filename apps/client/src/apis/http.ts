import { createApiClient, UnauthorizedError } from "@next-meal/api-client";
import { clearCurrentDiningGroupPreference } from "@/stores/dining-group-preference";
import { DEFAULT_API_BASE_URL } from "@/utils/constants";
import { emitSessionCleared } from "@/utils/session-events";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { mockRequestAdapter } from "./adapters/mock";
import { uniRequestAdapter } from "./adapters/uni";

const API_MODE = import.meta.env.VITE_API_MODE ?? "mock";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  request: API_MODE === "real" ? uniRequestAdapter : mockRequestAdapter,
  getAuthHeader: () => {
    const token = useSessionStore().token;
    return token ? `Bearer ${token}` : null;
  },
  async onUnauthorized(error: UnauthorizedError) {
    await useSessionStore().clearSession();
    useUserStore().clearProfile();
    await clearCurrentDiningGroupPreference();
    await emitSessionCleared();
    throw error;
  }
});
