declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

declare module "*.scss";

declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.gif" {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_DOMAIN?: string;
  readonly VITE_AUTH_DOMAIN?: string;
  readonly VITE_COOK_FROM?: "mini_program" | "h5" | "pc" | "ios" | "android" | "harmony";
  readonly VITE_COOK_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
