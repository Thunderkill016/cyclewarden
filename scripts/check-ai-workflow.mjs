import { spawnSync } from "node:child_process";
import { readFile, access } from "node:fs/promises";
import "./check-capabilities.mjs";

const required = [
  "AGENTS.md",
  "AI_WORKFLOW.md",
  "IDEA.md",
  "ARCHITECTURE.md",
  "docs/CAPABILITIES.json",
  "docs/ai/PROJECT_MODEL.md",
  "docs/ai/OPERATING_MODEL.md",
  "docs/ai/TASK_LIFECYCLE.md",
  "docs/ai/CONTEXT_ENGINEERING.md",
  "docs/ai/VERIFICATION.md",
  "docs/ai/SAFETY.md",
  "docs/ai/LEARNING_MODE.md",
  "docs/ai/AUTONOMOUS_IMPROVEMENT.md",
  "docs/ai/DISCOVERY_RESEARCH.md",
  "docs/ai/SOURCES.md",
  "docs/ai/improvements/README.md",
  "docs/ai/improvements/INDEX.md",
  "docs/ai/research/README.md",
  "docs/ai/research/INDEX.md",
  "docs/evolution/EXTERNAL_SYSTEMS.json",
  "docs/evolution/pilot/A2_RESEARCH_AUDIT_PROTOCOL.json",
  "docs/evolution/pilot/PILOT_STATE.json",
  "docs/evolution/pilot/SESSION_TEMPLATE.json",
  "docs/evolution/pilot/README.md",
  "docs/evolution/pilot/REPORT_TEMPLATE.md",
  "docs/ai/templates/IMPLEMENTATION_PLAN.md",
  "docs/ai/templates/PROJECT_MODEL.md",
  "docs/ai/templates/PROJECT_HEALTH_REPORT.md",
  "docs/ai/templates/IMPROVEMENT_PROPOSAL.md",
  "docs/ai/templates/RESEARCH_BRIEF.md",
  "docs/ai/templates/EVIDENCE_LEDGER.md",
  "docs/ai/templates/OPPORTUNITY_BRIEF.md",
  "docs/ai/templates/EXPERIMENT_CARD.md",
  "docs/ai/templates/RESEARCH_RETROSPECTIVE.md",
  "prompts/00-improve-project.md",
  "prompts/00-discover-opportunity.md",
  "prompts/00-validate-idea.md",
  "prompts/01-audit.md",
  "prompts/02-plan.md",
  "prompts/03-implement.md",
  "prompts/04-review.md",
  ".agents/skills/improve-project/SKILL.md",
  ".agents/skills/discover-opportunity/SKILL.md",
  ".github/ISSUE_TEMPLATE/improvement.yml",
  ".github/ISSUE_TEMPLATE/research.yml",
  ".github/copilot-instructions.md",
  ".github/pull_request_template.md",
  "scripts/check-capabilities.mjs",
  "scripts/test-capabilities.mjs",
  "scripts/external-systems-validation.mjs",
  "scripts/check-external-systems.mjs",
  "scripts/test-external-systems.mjs",
  "scripts/a2-pilot-validation.mjs",
  "scripts/check-a2-pilot.mjs",
  "scripts/test-a2-pilot.mjs",
  "scripts/create-cyclewarden.mjs",
  "scripts/test-create-cyclewarden.mjs",
];

const missing = [];
for (const file of required) {
  try {
    await access(file);
  } catch {
    missing.push(file);
  }
}

const activeDocs = [
  "AGENTS.md",
  "AI_WORKFLOW.md",
  ".github/copilot-instructions.md",
];

const placeholderPattern = /\b(TODO|TBD|FIXME)\b|<name>|YYYY-MM-DD/;
const unresolved = [];

for (const file of activeDocs) {
  const content = await readFile(file, "utf8");
  if (placeholderPattern.test(content)) unresolved.push(file);
}

const contentChecks = [
  {
    file: "docs/ai/AUTONOMOUS_IMPROVEMENT.md",
    phrases: ["Autonomy levels", "project model", "Stop and escalation conditions"],
  },
  {
    file: "docs/ai/DISCOVERY_RESEARCH.md",
    phrases: ["evidence ledger", "contradiction", "cheapest useful experiment"],
  },
  {
    file: "AGENTS.md",
    phrases: ["Default to A2", "Never claim to understand the entire project"],
  },
];

const incomplete = [];
for (const check of contentChecks) {
  const content = await readFile(check.file, "utf8");
  const missingPhrases = check.phrases.filter((phrase) => !content.includes(phrase));
  if (missingPhrases.length) incomplete.push({ file: check.file, missingPhrases });
}

if (missing.length || unresolved.length || incomplete.length) {
  console.error("AI workflow validation failed.");

  if (missing.length) {
    console.error("\nMissing required files:");
    for (const file of missing) console.error(`- ${file}`);
  }

  if (unresolved.length) {
    console.error("\nUnresolved placeholders in active documents:");
    for (const file of unresolved) console.error(`- ${file}`);
  }

  if (incomplete.length) {
    console.error("\nRequired workflow concepts are missing:");
    for (const item of incomplete) {
      console.error(`- ${item.file}: ${item.missingPhrases.join(", ")}`);
    }
  }

  process.exit(1);
}

console.log(`AI workflow OK: ${required.length} required files present.`);

if (process.env.GITHUB_HEAD_REF !== "agent/atoryn-forge-evidence-review") {
  process.exit(0);
}

function run(command, args) {
  console.log(`\n[Forge evidence final gate] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: "true" },
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

run("corepack", ["enable"]);
run("corepack", ["prepare", "pnpm@9.15.0", "--activate"]);
run("pnpm", ["install", "--frozen-lockfile"]);
run("pnpm", ["--filter", "@cyclewarden/forge-domain", "build"]);
run("pnpm", ["--filter", "@cyclewarden/web", "typecheck"]);
run("pnpm", ["--filter", "@cyclewarden/web", "build"]);
console.log("\nForge evidence review final web gate passed.");
