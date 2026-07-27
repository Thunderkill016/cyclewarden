import { access, readFile } from "node:fs/promises";

const required = [
  "AGENTS.md",
  "AI_WORKFLOW.md",
  "PROJECT_OS_SCOPE.md",
  "PRACTICAL_SCOPE.md",
  "README.md",
  "ROADMAP.md",
  "IDEA.md",
  "ARCHITECTURE.md",
  "docs/research/AI_PROJECT_OS_LANDSCAPE.md",
  "docs/project-os/PILOT_PROTOCOL.md",
  "docs/project-os/pilots/MONEYFLOW_BROWNFIELD.md",
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
  "scripts/cw.mjs",
  "scripts/cw-cli.mjs",
  "scripts/cw.test.mjs",
  "scripts/cw.verify.test.mjs",
  "scripts/cw.moneyflow.test.mjs",
  "fixtures/project-os/moneyflow/.cyclewarden/project.json",
  "fixtures/project-os/moneyflow/.cyclewarden/roadmap.json",
  "fixtures/project-os/moneyflow/.cyclewarden/status.json",
];

const errors = [];

for (const file of required) {
  try {
    await access(file);
  } catch {
    errors.push(`missing required workflow file: ${file}`);
  }
}

const activeDocs = [
  "AGENTS.md",
  "AI_WORKFLOW.md",
  "PROJECT_OS_SCOPE.md",
  "README.md",
  "ROADMAP.md",
  ".github/copilot-instructions.md",
];

const placeholderPattern = /\b(TODO|TBD|FIXME)\b|<name>|YYYY-MM-DD/;
for (const file of activeDocs) {
  const content = await readFile(file, "utf8");
  if (placeholderPattern.test(content)) {
    errors.push(`unresolved placeholder in active document: ${file}`);
  }
}

const requiredLinks = {
  "AGENTS.md": [
    "PROJECT_OS_SCOPE.md",
    "docs/project-os/PILOT_PROTOCOL.md",
    "ROADMAP.md",
    "scripts/cw.mjs",
  ],
  "README.md": [
    "PROJECT_OS_SCOPE.md",
    "docs/research/AI_PROJECT_OS_LANDSCAPE.md",
    "docs/project-os/PILOT_PROTOCOL.md",
    "PRACTICAL_SCOPE.md",
  ],
  "PROJECT_OS_SCOPE.md": [
    "docs/research/AI_PROJECT_OS_LANDSCAPE.md",
    "docs/project-os/PILOT_PROTOCOL.md",
    "scripts/cw.mjs",
  ],
  "ROADMAP.md": [
    "PROJECT_OS_SCOPE.md",
    "docs/research/AI_PROJECT_OS_LANDSCAPE.md",
    "PRACTICAL_SCOPE.md",
  ],
  "AI_WORKFLOW.md": [
    "PROJECT_OS_SCOPE.md",
    "docs/project-os/PILOT_PROTOCOL.md",
    "ROADMAP.md",
  ],
};

for (const [file, links] of Object.entries(requiredLinks)) {
  const content = await readFile(file, "utf8");
  for (const link of links) {
    if (!content.includes(link)) {
      errors.push(`${file} must reference ${link}`);
    }
  }
}

let packageJson;
try {
  packageJson = JSON.parse(await readFile("package.json", "utf8"));
} catch (error) {
  errors.push(`package.json could not be parsed: ${error.message}`);
}

if (packageJson) {
  const scripts = packageJson.scripts ?? {};
  if (scripts.cw !== "node scripts/cw-cli.mjs") {
    errors.push("package.json scripts.cw must invoke scripts/cw-cli.mjs");
  }
  if (!String(scripts["test:project-os"] ?? "").includes("cw.test.mjs")) {
    errors.push("package.json test:project-os must run the Project OS tests");
  }
  if (!String(scripts["test:project-os"] ?? "").includes("cw.verify.test.mjs")) {
    errors.push("package.json test:project-os must run verify lifecycle tests");
  }
  if (!String(scripts["test:project-os"] ?? "").includes("cw.moneyflow.test.mjs")) {
    errors.push("package.json test:project-os must run the MoneyFlow pilot tests");
  }
  if (!String(scripts["check:ai"] ?? "").includes("test:project-os")) {
    errors.push("package.json check:ai must include test:project-os");
  }
}

for (const file of [
  "fixtures/project-os/moneyflow/.cyclewarden/project.json",
  "fixtures/project-os/moneyflow/.cyclewarden/roadmap.json",
  "fixtures/project-os/moneyflow/.cyclewarden/status.json",
]) {
  try {
    JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    errors.push(`${file} could not be parsed: ${error.message}`);
  }
}

if (errors.length > 0) {
  console.error("AI workflow validation failed.");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `AI workflow OK: ${required.length} required files and stable Project OS contracts validated.`,
);
