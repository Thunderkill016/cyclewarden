# JS Practice Loop — JPL-001

This is the implementation test for CycleWarden's first greenfield active task.

## User outcome

A learner can:

1. enter a real JavaScript exercise;
2. record their own unfinished reasoning or code;
3. save the attempt locally;
4. reload the page and recover the same record.

## Deliberate boundaries

This slice has:

- React and TypeScript through Vite;
- semantic HTML and plain CSS;
- a versioned `localStorage` repository;
- unit tests for validation and persistence;
- Playwright coverage for create-save-reload and plain-text rendering.

This slice does **not** have:

- AI hints, generated answers, or model calls;
- code execution, `eval`, `Function`, iframe sandboxes, or HTML rendering;
- accounts, authentication, backend APIs, cloud databases, or sync;
- analytics, streaks, spaced-repetition algorithms, broad navigation, or a component library.

## Commands

```bash
npm install
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Acceptance boundary

Passing automated checks means only that the bounded create-save-reload slice works as specified. It does not prove the learning product is useful. Product evidence requires the owner to record at least five real exercises without the app pushing them toward generated answers.
