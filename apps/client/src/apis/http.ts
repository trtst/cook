import { createApiClient, UnauthorizedError } from "@next-meal/api-client";
import { emitSessionCleared } from "@/utils/session-events";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import {
  downloadFile as uniDownloadFile,
  getApiUrl,
  uniRequestAdapter,
  uploadFile as uniUploadFile,
  type DownloadFileOptions,
  type UploadFileOptions
} from "./adapters/uni";

const refreshWindowMs = 3 * 24 * 60 * 60 * 1000;
const refreshGapMs = 10 * 60 * 1000;

export const api = createApiClient({
  baseUrl: getApiUrl(),
  request: uniRequestAdapter,
  getAuthHeader: () => {
    const token = useSessionStore().token;
    return token ? `Bearer ${token}` : null;
  },
  async onUnauthorized(error: UnauthorizedError) {
    await useSessionStore().clearSession();
    useUserStore().clearProfile();
    await emitSessionCleared();
    throw error;
  }
});

function withAuth(headers: Record<string, string> = {}) {
  const token = useSessionStore().token;

  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export function uploadFile(options: UploadFileOptions) {
  return uniUploadFile({
    ...options,
    headers: withAuth(options.headers)
  });
}

export function downloadFile(options: DownloadFileOptions) {
  return uniDownloadFile({
    ...options,
    headers: withAuth(options.headers)
  });
}

let refreshPromise: Promise<void> | null = null;

function shouldRefresh(expiresAt: string) {
  const expiresTime = Date.parse(expiresAt);
  return Number.isFinite(expiresTime) && expiresTime - Date.now() <= refreshWindowMs;
}

function canCheckRefresh(lastCheckedAt: number) {
  return Date.now() - lastCheckedAt >= refreshGapMs;
}

export async function refreshSessionIfNeeded() {
  const sessionStore = useSessionStore();

  if (!sessionStore.token || !shouldRefresh(sessionStore.expiresAt) || !canCheckRefresh(sessionStore.refreshCheckedAt)) return;

  refreshPromise ??= api.auth
    .refreshSession()
    .then(async session => {
      await sessionStore.setSession({
        token: session.token,
        userId: sessionStore.userId,
        expiresAt: session.expiresAt
      });
    })
    .finally(async () => {
      await useSessionStore().markRefreshChecked();
      refreshPromise = null;
    });

  await refreshPromise;
}
