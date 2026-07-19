export interface AdminAppConfig {
  apiBaseUrl: string;
  adminTokenStorageKey: string;
  appVersion: string;
  appBuild: number;
}

export const adminAppConfig: AdminAppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3000/api",
  adminTokenStorageKey: import.meta.env.VITE_ADMIN_TOKEN_STORAGE_KEY ?? "next_meal_admin_token",
  appVersion: import.meta.env.VITE_ADMIN_VERSION ?? "0.1.0",
  appBuild: Number(import.meta.env.VITE_ADMIN_BUILD ?? 1)
};
