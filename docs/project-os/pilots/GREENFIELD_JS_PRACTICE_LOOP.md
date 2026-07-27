# Greenfield pilot — JS Practice Loop

## Hypothesis

CycleWarden should help a non-expert owner turn a vague software idea into one bounded, technically coherent task before a coding agent begins implementation.

This pilot starts from the owner's recurring problem: JavaScript exercises are difficult, AI can produce a solution quickly, but the owner does not retain enough of the reasoning.

## Existing-product boundary

The pilot does not attempt to replace:

- programming curricula and exercise providers;
- general flashcard and spaced-repetition tools;
- AI coding assistants;
- browser IDEs and code sandboxes.

The candidate gap is a small owner-specific record connecting a real exercise, the learner's own attempt, the mistake, and a later retry.

## Shaping result

### Target user

One Vietnamese beginner currently learning JavaScript.

### Core problem

When stuck, the learner often receives a complete AI solution before fully expressing their own attempt. The immediate problem is not lack of content; it is loss of the learner's reasoning, mistakes, and opportunity to retry.

### First useful outcome

The learner can create one practice attempt, save it locally, reload the page, and recover the same record.

This is useful without accounts, AI, review scheduling, analytics, or deployment.

### Non-goals

- full course or lesson authoring;
- generated hints or answers;
- code execution;
- authentication and cross-device sync;
- streaks, points, social comparison, subscriptions, or teams;
- automatic learning claims;
- a general note-taking app.

## Design decision

Use a mobile-first single-column utility with three candidate screens:

1. Today / recent attempts.
2. New practice attempt.
3. Attempt detail.

The first slice needs only the first two states plus saved output. It should use semantic HTML, plain Vietnamese labels, one primary action, and explicit empty/validation/saved/reload states.

No component library is justified yet. A design system is limited to CSS tokens for spacing, typography, border, focus, success, warning, and error states.

## Technology decision

### Frontend

**Decision:** React + TypeScript using Vite.

**Reason:** the product is a small client-side interactive app. It does not need server rendering, server actions, or route-level backend behavior. The official Vite template provides a small React/TypeScript start without choosing a larger full-stack architecture.

**Rejected for now:** Next.js, because the first slice has no server or authentication requirement; vanilla JavaScript, because the intended project should remain structured as UI and state grow beyond one form.

### Data

**Decision:** versioned JSON in `localStorage`, hidden behind a repository interface.

**Reason:** one owner, one device, very small data, no sync requirement, and a need to prove actual use before operating a database.

**Reconsider when:** records become large, queries become complex, storage limits are observed, or cross-device use becomes a confirmed need.

### Backend and authentication

**Decision:** none.

Adding Supabase, Firebase, an API, user accounts, session management, secrets, migrations, RLS, or deployment configuration would solve problems not present in the first useful flow.

### Styling and UI libraries

**Decision:** plain CSS and repository-owned components. No Tailwind, shadcn/ui, Radix dependency, or large component library in the first slice.

**Reconsider when:** repeated components or accessibility-heavy interactions appear in actual slices.

### Testing

**Decision:** Vitest for validation/storage behavior and Playwright for the create-save-reload flow.

Browser evidence matters because persistence and reload are part of the product outcome, not implementation details.

## Architecture decision

```text
UI feature
→ domain validation and attempt model
→ storage repository
→ browser localStorage
```

Suggested boundaries:

```text
src/
├── domain/
│   └── practice.ts
├── storage/
│   └── practiceRepository.ts
├── features/
│   └── practice/
└── components/
```

Rules:

- UI components do not access `localStorage` directly.
- Prompts and attempts are plain text and never rendered as HTML.
- The app never executes learner code.
- Storage data includes a schema version.
- Technology changes require a repeated need, not agent preference.

## Roadmap decision

The roadmap has five vertical slices:

1. Create, save, list, and reload one attempt.
2. Record mistake and lesson learned.
3. Retry a due mistake without seeing the old answer first.
4. Show a factual history of repeated mistake labels.
5. Export and restore a local backup.

Only slice 1 is active.

## Active task contract

`JPL-001 — Create and persist one JavaScript practice attempt`

The implementation agent may touch the project scaffold, domain model, storage boundary, practice form/list UI, focused tests, and minimal CSS.

It may not add AI, code execution, accounts, backend, database, sync, analytics, review algorithms, broad navigation, or a component library.

## Evaluation

The greenfield shaping phase passes when:

- `cw validate` accepts the project model;
- `cw next` returns `JPL-001`;
- exactly one task is active;
- stack, storage, auth, backend, design, testing, safety, architecture, non-goals, and kill criteria are explicit;
- later work remains dependency-blocked;
- the contract is small enough for a coding agent to implement one slice without asking what to build next.

It does not prove that the product itself is useful. That requires implementing `JPL-001` and observing whether the owner records five real exercises.
