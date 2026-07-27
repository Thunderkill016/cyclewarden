# CycleWarden build-or-not assessment protocol

Status: pilot contract

Evidence basis: [`EVIDENCE_BASE.md`](EVIDENCE_BASE.md)

## Purpose

The assessment phase decides whether a proposed project or major initiative should proceed to shaping and implementation.

It exists to prevent this failure mode:

```text
plausible idea
→ AI creates a convincing product story
→ AI chooses a stack and roadmap
→ agent delivers clean code
→ owner discovers the product was not worth using
```

A technically successful implementation is not evidence that the product should have been built.

## Decision outcomes

An assessment must end in one explicit decision:

- `pending` — evidence is incomplete; implementation remains locked;
- `build` — evidence supports a bounded software experiment;
- `use-existing` — an existing product solves the problem adequately;
- `manual` — a no-code or manual workflow is sufficient;
- `stop` — the problem, value, timing, or cost does not justify further work;
- `existing-project` — CycleWarden is adopting an already-running repository; this does not validate new broad initiatives.

`use-existing`, `manual`, and `stop` are successful outcomes when they avoid unnecessary software.

## Evidence policy

### Evidence that may support a product decision

- direct owner or user observation;
- user research;
- repository behavior, issues, incidents, or support evidence;
- analytics or operational data;
- a completed manual, prototype, or no-code experiment;
- documented behavior of an existing solution.

### Inputs that cannot unlock `build` alone

- AI-generated reasoning;
- an attractive mock-up;
- a technology preference;
- a competitor list without observing the user's current behavior;
- external product-development methodology;
- automated tests proving only that implementation works.

These may guide investigation, but they do not prove demand or usefulness.

## Assessment questions

### 1. Problem and current behavior

Record:

- who experiences the problem;
- what they are trying to achieve;
- what triggers the problem;
- how often it occurs;
- what they do today;
- the measurable or observable cost of the current situation.

Unsupported claims must be marked as assumptions or inferences.

### 2. Existing and simpler solutions

Review:

- existing products;
- existing repository functionality;
- spreadsheets, documents, scripts, or manual workflows;
- changing an existing process instead of building software.

For each option record the source, fit, limitation, and why it is or is not sufficient.

### 3. Cheapest reliable test

Choose the smallest test that can disprove the need to build, such as:

- using a Markdown template for five real cases;
- performing the workflow manually;
- testing a clickable or throwaway prototype;
- measuring current behavior from repository or operational data;
- trying an existing product under real conditions.

The test may be exempt only when the reason is explicit and the remaining evidence is strong enough for the risk involved.

### 4. Value, usage cost, and appetite

Record:

- the expected user outcome;
- how success will be observed;
- interaction cost for the user;
- maintenance and operating cost;
- the maximum time or effort worth spending now;
- explicit no-gos.

The assessment is not a business-case spreadsheet. It only needs enough evidence to avoid a default-to-build decision.

### 5. Decision and kill criteria

The decision references the exact evidence items that support it.

Before implementation begins, define conditions that would stop or reshape the work. Examples:

- an existing solution proves adequate;
- the user does not perform the manual workflow;
- usage friction exceeds the observed benefit;
- the first bounded experiment cannot measure the promised outcome;
- the required security, legal, or operational cost exceeds the appetite.

## Unlock rule

For a greenfield project, `build` requires:

1. at least one direct product-evidence item;
2. review of at least one existing or simpler solution;
3. a completed manual/no-code test, or a documented exemption;
4. at least one success measure;
5. an explicit appetite;
6. kill criteria;
7. a decision rationale that references evidence IDs.

An `inference` or `external-method` item cannot be the only evidence referenced by the decision.

When the decision is not `build`, roadmap tasks may remain `proposed`, `blocked`, `done`, or `dropped`, but none may be `ready`, `active`, or `verify`.

## Brownfield boundary

`existing-project` permits CycleWarden to map and manage an already-running repository. It means only:

- the repository already exists;
- the owner explicitly chose to adopt it;
- current work may be recovered from repository evidence.

It does not automatically approve a new redesign, platform rewrite, or major feature. Those require their own initiative assessment.

## Lifecycle

```text
idea
→ assessment
   ├── use-existing
   ├── manual
   ├── stop
   └── build
       → shape
       → plan
       → implement one bounded task
       → verify
       → owner accept/reject
       → measure real use
       → continue, reshape, or stop
```

The assessment is revisited when real use contradicts the original decision. Product failure after technical success must update the assessment rather than being hidden behind passing tests.
