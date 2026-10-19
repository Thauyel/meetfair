import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: process.env.LIVE ? ["scripts/**/*.live.ts"] : ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
