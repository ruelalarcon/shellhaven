// vite.config.ts
import { defineConfig } from "file:///mnt/c/Users/ru3lr/Desktop/Programs/Projects/terminal_dashboard/node_modules/vite/dist/node/index.js";
import { svelte } from "file:///mnt/c/Users/ru3lr/Desktop/Programs/Projects/terminal_dashboard/client/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
import path from "path";
var __vite_injected_original_dirname = "/mnt/c/Users/ru3lr/Desktop/Programs/Projects/terminal_dashboard/client";
var vite_config_default = defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "~shared": path.resolve(__vite_injected_original_dirname, "../shared")
    }
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:7456",
      "/ws": {
        target: "ws://127.0.0.1:7456",
        ws: true
      }
    }
  },
  build: {
    outDir: "dist"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvbW50L2MvVXNlcnMvcnUzbHIvRGVza3RvcC9Qcm9ncmFtcy9Qcm9qZWN0cy90ZXJtaW5hbF9kYXNoYm9hcmQvY2xpZW50XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvbW50L2MvVXNlcnMvcnUzbHIvRGVza3RvcC9Qcm9ncmFtcy9Qcm9qZWN0cy90ZXJtaW5hbF9kYXNoYm9hcmQvY2xpZW50L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9tbnQvYy9Vc2Vycy9ydTNsci9EZXNrdG9wL1Byb2dyYW1zL1Byb2plY3RzL3Rlcm1pbmFsX2Rhc2hib2FyZC9jbGllbnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHsgc3ZlbHRlIH0gZnJvbSBcIkBzdmVsdGVqcy92aXRlLXBsdWdpbi1zdmVsdGVcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtzdmVsdGUoKV0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgXCJ+c2hhcmVkXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi4vc2hhcmVkXCIpLFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHByb3h5OiB7XG4gICAgICBcIi9hcGlcIjogXCJodHRwOi8vMTI3LjAuMC4xOjc0NTZcIixcbiAgICAgIFwiL3dzXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBcIndzOi8vMTI3LjAuMC4xOjc0NTZcIixcbiAgICAgICAgd3M6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiBcImRpc3RcIixcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFvWSxTQUFTLG9CQUFvQjtBQUNqYSxTQUFTLGNBQWM7QUFDdkIsT0FBTyxVQUFVO0FBRmpCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxPQUFPLENBQUM7QUFBQSxFQUNsQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxXQUFXLEtBQUssUUFBUSxrQ0FBVyxXQUFXO0FBQUEsSUFDaEQ7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixPQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsUUFDUixJQUFJO0FBQUEsTUFDTjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsRUFDVjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
