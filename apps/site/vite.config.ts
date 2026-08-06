import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

function readPort(value: string | undefined, fallback: number) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

function resolveChunk(id: string) {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("/vue-router/")) return "vue-router";
  if (id.includes("/vue/") || id.includes("/@vue/")) return "vue-core";
  return "vendor";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    server: {
      host: env.VITE_DEV_HOST || "127.0.0.1",
      port: readPort(env.VITE_DEV_PORT, 5176),
      strictPort: true,
      watch: {
        usePolling: true,
        interval: 120,
        awaitWriteFinish: {
          stabilityThreshold: 120,
          pollInterval: 40
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: resolveChunk
        }
      }
    }
  };
});
