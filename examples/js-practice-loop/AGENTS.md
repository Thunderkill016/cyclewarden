# JS Practice Loop agent instructions

The active task is `JPL-001`: create, save, list and reload one JavaScript practice attempt.

## Allowed scope

- Vite/React/TypeScript project setup inside this directory
- practice-attempt domain validation
- a storage repository backed by versioned `localStorage`
- the create form, empty state and recent-attempt list
- plain CSS needed for a mobile-first accessible flow
- focused unit and Playwright tests

## Forbidden scope

Do not add:

- AI hints, generated answers or model-provider calls;
- code execution, `eval`, `Function`, iframe sandboxes or HTML injection;
- authentication, backend APIs, Supabase, Firebase or cloud databases;
- sync, deployment, analytics, streaks or review scheduling;
- routers, dashboards, broad navigation or component libraries;
- later roadmap slices such as mistake labels, retry scheduling or backup import/export.

## Architecture rules

- UI components must not access `localStorage` directly.
- Learner text must be rendered as text, never as HTML.
- Stored data must include a schema version.
- Keep one primary action: save the learner's own attempt.

## Verification

Run inside this directory:

```bash
npm test
npm run build
npm run test:e2e
```

Report exact results. Do not mark `JPL-001` accepted; acceptance belongs to the owner after reviewing the evidence.
