import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const config = defineConfig({
  plugins: [react() as never],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    css: true,
  },
  resolve: {
    alias: { "@": "/src" },
  },
});

export default config;
