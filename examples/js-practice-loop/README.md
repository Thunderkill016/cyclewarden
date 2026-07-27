# JS Practice Loop — JPL-002

This isolated pilot tests the second bounded CycleWarden greenfield slice.

## User outcome

A learner can:

1. record a real JavaScript exercise and their own attempt;
2. add what was wrong;
3. add what they learned;
4. reload and recover the reflection;
5. edit the reflection without duplicating the attempt.

## Data compatibility

JPL-001 stored schema version 1. JPL-002 reads those records without data loss and writes schema version 2 when the attempt is next saved.

## Deliberate boundaries

This slice keeps:

- React and TypeScript through Vite;
- semantic HTML and plain CSS;
- a versioned `localStorage` repository;
- unit tests for validation, migration and editing;
- Playwright coverage for reflection persistence and plain-text rendering.

It does **not** add AI, code execution, accounts, backend APIs, cloud databases, sync, analytics, scoring, streaks, review scheduling, mistake taxonomy, broad navigation or a component library.

## Commands

```bash
npm install
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Acceptance boundary

Passing checks proves only that editable reflection works and old local data remains safe. It does not prove the reflection improves learning; owner review and real use remain separate evidence.
