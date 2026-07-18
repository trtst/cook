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

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_MODE?: "mock" | "real";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
