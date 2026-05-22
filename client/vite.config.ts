import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "~shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:7456",
      "/ws": {
        target: "ws://127.0.0.1:7456",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
