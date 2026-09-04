import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ["@huggingface/transformers", "vosk-browser"],
  },
  worker: {
    format: "es",
  },
  assetsInclude: ["**/*.wasm"],
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: path.resolve(root, "index.html"),
      },
    },
  },
});
