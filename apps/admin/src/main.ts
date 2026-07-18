export interface AdminAppConfig {
  apiBaseUrl: string;
  adminTokenStorageKey: string;
}

const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export const adminAppConfig: AdminAppConfig = {
  apiBaseUrl: runtimeEnv.VITE_API_BASE_URL ?? "http://127.0.0.1:3000/api",
  adminTokenStorageKey: runtimeEnv.VITE_ADMIN_TOKEN_STORAGE_KEY ?? "next_meal_admin_token"
};

export function bootstrapAdminShell() {
  return {
    app: "next-meal-admin",
    config: adminAppConfig
  };
}
