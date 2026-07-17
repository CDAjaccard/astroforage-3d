import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@astroforage/shared": path.resolve(__dirname, "shared/src/index.ts")
    }
  },
  test: {
    include: ["shared/test/**/*.test.ts", "server/test/**/*.test.ts"]
  }
});
