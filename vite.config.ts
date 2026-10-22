import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The phone reaches the dev server through a Cloudflare quick tunnel (see the README).
  server: { allowedHosts: [".trycloudflare.com"] },
  test: {
    projects: [
      {
        test: {
          name: "core",
          environment: "node",
          include: ["src/features/*/core/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: [
            ...configDefaults.exclude,
            "src/features/*/core/**/*.test.ts",
          ],
          setupFiles: ["./src/testing/setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/app/main.tsx", "**/*.test.{ts,tsx}", "**/testing/**"],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
