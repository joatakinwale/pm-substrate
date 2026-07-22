import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    include: ["packages/**/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/._*"],
    passWithNoTests: true,
    globalSetup: ["scripts/vitest-ci-db-guard.ts"],
    // Explicit empty css config — prevents Vite from searching parent dirs
    // for a postcss.config.js (the WD_BLACK drive has another project's
    // config one level up that we must not pick up).
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: ".",
});
