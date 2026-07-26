import { readFile, access } from "node:fs/promises";

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
  "scripts/cw.test.mjs",
  "scripts/cw.moneyflow.test.mjs",
  "fixtures/project-os/moneyflow/.cyclewarden/project.json",
  "fixtures/project-os/moneyflow/.cyclewarden/roadmap.json",
  "fixtures/project-os/moneyflow/.cyclewarden/status.json",
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
  "PROJECT_OS_SCOPE.md",
  "README.md",
  "ROADMAP.md",
  ".github/copilot-instructions.md",
];

const placeholderPattern = /\b(TODO|TBD|FIXME)\b|<name>|YYYY-MM-DD/;
const unresolved = [];
for (const file of activeDocs) {
  const content = await readFile(file, "utf8");
  if (placeholderPattern.test(content)) unresolved.push(file);
}

const conceptChecks = [
  {
    file: "docs/ai/AUTONOMOUS_IMPROVEMENT.md",
    patterns: [
      { label: "autonomy levels", regex: /Autonomy levels/i },
      { label: "project model", regex: /project model/i },
      { label: "stop and escalation conditions", regex: /Stop and escalation conditions/i },
    ],
  },
  {
    file: "docs/ai/DISCOVERY_RESEARCH.md",
    patterns: [
      { label: "evidence ledger", regex: /evidence ledger/i },
      { label: "contradiction", regex: /contradiction/i },
      { label: "cheapest useful experiment", regex: /cheapest useful experiment/i },
    ],
  },
  {
    file: "AGENTS.md",
    patterns: [
      { label: "one-active-task rule", regex: /at most one project task is active/i },
      { label: "no separate model provider", regex: /must not require a separate model provider/i },
      { label: "Project OS test command", regex: /pnpm test:project-os/ },
      { label: "repository state contract", regex: /\.cyclewarden\// },
    ],
  },
  {
    file: "PROJECT_OS_SCOPE.md",
    patterns: [
      { label: "one-active-task rule", regex: /at most one task may be `active`/i },
      { label: "no separate model provider", regex: /requires no separate model provider/i },
      { label: "deterministic CLI implementation", regex: /scripts\/cw\.mjs/ },
      { label: "MoneyFlow brownfield evidence", regex: /Brownfield pilot evidence/i },
    ],
  },
  {
    file: "AI_WORKFLOW.md",
    patterns: [
      { label: "Project OS loop", regex: /Project OS loop/i },
      { label: "one active task", regex: /exactly one task is active/i },
      { label: "deterministic validation", regex: /Deterministic validation/i },
    ],
  },
  {
    file: "README.md",
    patterns: [
      { label: "free local product", regex: /free local project operating layer/i },
      { label: "validate command", regex: /pnpm cw -- validate/ },
      { label: "MoneyFlow pilot", regex: /brownfield pilot:\s*MoneyFlow/i },
      { label: "no duplicate token spend", regex: /duplicate token spend/i },
    ],
  },
  {
    file: "ROADMAP.md",
    patterns: [
      { label: "MoneyFlow adoption milestone", regex: /MoneyFlow brownfield adoption/i },
      { label: "deterministic CLI milestone", regex: /smallest deterministic CLI/i },
      { label: "no model calls", regex: /no model calls or provider keys/i },
    ],
  },
];

const incomplete = [];
for (const check of conceptChecks) {
  const content = await readFile(check.file, "utf8");
  const missingConcepts = check.patterns
    .filter(({ regex }) => !regex.test(content))
    .map(({ label }) => label);
  if (missingConcepts.length) incomplete.push({ file: check.file, missingConcepts });
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
      console.error(`- ${item.file}: ${item.missingConcepts.join(", ")}`);
    }
  }

  process.exit(1);
}

console.log(`AI workflow OK: ${required.length} required files present.`);
