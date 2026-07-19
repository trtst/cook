import { APP_VERSION } from "./app";

export type CookFrom = "mini_program" | "h5" | "pc" | "ios" | "android" | "harmony";

export const appConfig = {
  apiUrl: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3100/api",
  cookFrom: import.meta.env.VITE_COOK_FROM,
  cookVersion: import.meta.env.VITE_COOK_VERSION ?? APP_VERSION
};
