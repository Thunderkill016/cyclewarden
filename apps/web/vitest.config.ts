import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@cyclewarden/forge-domain": resolve(
        __dirname,
        "../../packages/forge-domain/src/index.ts",
      ),
    },
  },
});
