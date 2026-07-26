# Brownfield pilot 01 — MoneyFlow

Status: project-state mapping implemented; human readiness task still active  
Target repository: `Thunderkill016/moneyflow`  
Tracking issue: `Thunderkill016/moneyflow#85`  
CycleWarden issue: #59

## Pilot question

Can CycleWarden recover enough trustworthy project state from an existing repository to prevent a coding agent from starting the wrong work next?

## Evidence inspected

- `README.md`;
- `AGENTS.md`;
- `ARCHITECTURE.md`;
- `docs/product/PRINCIPLES.md`;
- `docs/MVP_DEFINITION.md`;
- `docs/engineering/AI_DELIVERY_WORKFLOW.md`;
- `package.json`;
- open issue #27, final manual readiness gates;
- open issue #81, broad Calm Ledger redesign;
- open UI quality issues #70 and #72.

No runtime code, production data, secret or personal financial record was inspected or changed.

## Recovered project truth

MoneyFlow is a manual-first Vietnamese personal ledger. Its core value is trustworthy transaction capture, balances, period reporting, recovery and export.

Foundation already exists and is not a pilot decision:

- Next.js App Router, React and TypeScript;
- Tailwind CSS and repository-owned design patterns;
- Supabase PostgreSQL and Auth for authenticated mode;
- browser-local data for demo mode;
- Zod and database constraints;
- unit, pgTAP, Playwright and UI-audit checks;
- Vercel deployment with explicit configuration.

Important invariants include integer VND, transfer exclusion from income/expense, RLS tenant isolation, recoverable destructive actions and spreadsheet-safe export.

## Sequencing conflict found

Issue #81 requests a broad redesign and is newer and larger than issue #27.

Issue #27 states that automated readiness gates are complete, but three checks still require real human evidence:

1. production email callback through an owner-controlled inbox;
2. synthetic CSV behavior in an end-user spreadsheet application;
3. transaction-form usability with a physical-phone keyboard.

It explicitly says not to add product features while the issue remains open.

A coding agent selecting work by recency, novelty or task size could begin the redesign. That would violate the current readiness contract.

## CycleWarden model

The MoneyFlow branch stores:

```text
.cyclewarden/
├── README.md
├── project.json
├── roadmap.json
└── status.json
```

Task sequence:

```text
MFVN-000 adoption map                      done
→ MFVN-001 manual readiness gates          active / human-only
→ MFVN-002 seven-day self-use              blocked
→ MFVN-003 Calm Ledger foundation          blocked
→ MFVN-004 Calm Ledger daily flows         blocked
→ MFVN-005 planning/settings               blocked
→ MFVN-006 cross-device acceptance         blocked
```

Exactly one task is active.

## Deterministic next result

```text
MFVN-001 — Complete final manual readiness gates
```

Reason: it is already active and all later work depends directly or indirectly on it.

The CLI test fixture asserts that:

- the model validates;
- `next` returns `MFVN-001`;
- the task is marked human-only;
- the redesign foundation remains blocked by seven-day self-use;
- status explains that the redesign must not begin.

## Value beyond AGENTS.md

`AGENTS.md` explains repository conventions, invariants and how an agent should work.

The `.cyclewarden` state adds a different capability:

- identifies the single current project task;
- represents dependencies across issues and phases;
- keeps human-only evidence visible;
- prevents a newer issue from replacing an unfinished readiness obligation;
- explains what follows after the active task.

This is the strongest current evidence for `cw status`, `cw next` and `cw validate`.

## Friction and limitations

- The state was mapped through GitHub repository evidence rather than a local checkout.
- No execution time was instrumented before work began; no duration is fabricated.
- The owner still has to perform the three manual checks.
- The pilot has not yet demonstrated a task transition from active to done.
- The artifact set duplicates some product facts; future use must show that the sequencing value exceeds maintenance cost.

## Provisional command decisions

| Command | Decision | Evidence |
| --- | --- | --- |
| `cw init` | test | no greenfield result yet |
| `cw adopt` | test | scaffold is useful, but repository interpretation still comes from the coding agent |
| `cw status` | keep for pilot | concise state exposes the human-only active task and blockers |
| `cw next` | keep for pilot | prevents the broad redesign from jumping ahead of readiness dependencies |
| `cw validate` | keep for pilot | deterministic one-active-task and dependency rules are directly testable |

These decisions remain provisional until the greenfield pilot and a fresh-session recovery test complete.

## Next actions

1. Let CI execute the Project OS tests.
2. Open and review the MoneyFlow artifact-only draft PR.
3. The owner performs issue #27 manual gates without exposing secrets or real financial data.
4. Update MoneyFlow state honestly to done, blocked or failed.
5. Run a real greenfield pilot before expanding the command surface.
