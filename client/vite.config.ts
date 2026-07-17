import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  base: "./", // chemins relatifs : requis pour le chargement file:// dans Electron
  resolve: {
    alias: {
      "@astroforage/shared": path.resolve(__dirname, "../shared/src/index.ts")
    }
  },
  server: {
    port: 5173
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200
  }
});
