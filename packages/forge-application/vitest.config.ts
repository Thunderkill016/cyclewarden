import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@cyclewarden/forge-domain": resolve(
        __dirname,
        "../forge-domain/src/index.ts",
      ),
    },
  },
  test: {
    // PostgreSQL integration suites intentionally share one disposable CI
    // database. Run files serially so one suite's TRUNCATE/reset cannot delete
    // another suite's fixture while preserving normal test isolation inside
    // each file.
    fileParallelism: false,
    maxWorkers: 1,
  },
});
