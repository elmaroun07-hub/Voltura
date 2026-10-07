import { defineConfig } from "vitest/config";
import path from "path";

// Its own config: vite.config.ts demands PORT outside a build, and the tests
// need neither a server nor the React/Tailwind plugins — only the "@" alias.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
