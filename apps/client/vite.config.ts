import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const uni = require("@dcloudio/vite-plugin-uni").default as typeof import("@dcloudio/vite-plugin-uni").default;

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
