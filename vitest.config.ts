import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/email/templates/**", "src/types/**", "src/terminal/banner.ts"],
      reporter: ["text-summary", "html"],
    },
  },
});
