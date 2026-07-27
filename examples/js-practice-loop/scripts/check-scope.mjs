import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const declaredPackages = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
};

const forbiddenPackages = [
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@openai/agents",
  "openai",
  "@supabase/supabase-js",
  "firebase",
  "next",
  "react-router",
  "react-router-dom",
  "@tanstack/react-router",
  "posthog-js",
  "mixpanel-browser",
];

const forbiddenSourcePatterns = [
  { pattern: /\beval\s*\(/u, label: "eval" },
  { pattern: /\bnew\s+Function\s*\(/u, label: "Function constructor" },
  { pattern: /dangerouslySetInnerHTML/u, label: "HTML injection" },
  { pattern: /<iframe\b/iu, label: "iframe execution surface" },
];

const errors = [];

for (const packageName of forbiddenPackages) {
  if (packageName in declaredPackages) {
    errors.push(`Forbidden package declared: ${packageName}`);
  }
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(absolute)));
      continue;
    }

    if ([".ts", ".tsx", ".js", ".jsx", ".html"].includes(extname(entry.name))) {
      files.push(absolute);
    }
  }

  return files;
}

for (const file of await collectSourceFiles(join(root, "src"))) {
  const source = await readFile(file, "utf8");

  for (const { pattern, label } of forbiddenSourcePatterns) {
    if (pattern.test(source)) {
      errors.push(`${relative(root, file)} contains forbidden ${label}`);
    }
  }
}

if (errors.length > 0) {
  console.error("JPL-003 scope validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("JPL-003 scope validation passed.");
}
