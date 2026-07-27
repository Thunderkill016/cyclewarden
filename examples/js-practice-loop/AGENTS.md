# JS Practice Loop agent instructions

The active task is `JPL-002`: let the learner record and edit what was wrong and what they learned for an existing practice attempt.

## Allowed scope

- optional reflection fields on a saved attempt;
- validation for both reflection fields;
- a safe schema v1 to v2 local-storage migration;
- add/edit reflection UI inside the existing attempt card;
- focused domain, storage and Playwright tests;
- mobile CSS needed for this bounded flow.

## Forbidden scope

Do not add:

- AI hints, generated answers or model-provider calls;
- code execution, `eval`, `Function`, iframe sandboxes or HTML injection;
- authentication, backend APIs, Supabase, Firebase or cloud databases;
- sync, deployment, analytics, streaks or review scheduling;
- mistake taxonomy, scores, dashboards or gamification;
- routers, broad navigation or component libraries;
- JPL-003 retry behavior or later roadmap slices.

## Architecture rules

- UI components must not access `localStorage` directly.
- Existing schema-v1 attempts must load without data loss.
- New writes use schema version 2.
- Learner text must be rendered as text, never as HTML.
- Editing a reflection updates the same attempt instead of creating a duplicate.

## Verification

Run inside this directory:

```bash
npm test
npm run build
npm run test:e2e
```

Report exact results. Automated checks may move JPL-002 to `verify`; only the owner may accept it as `done`.
