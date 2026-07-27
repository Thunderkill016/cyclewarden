# JS Practice Loop — JPL-002 result

## Outcome

JPL-002 added an editable reflection to an existing JavaScript practice attempt:

- `Sai ở đâu?`
- `Học được gì?`

The reflection is stored with the original attempt, survives reload and can be edited without creating a duplicate attempt.

## Compatibility

JPL-001 wrote storage schema version 1. JPL-002:

- reads valid version-1 records without data loss;
- supplies empty reflection fields during migration;
- writes schema version 2 on the next save;
- continues to fail closed for malformed or incompatible state.

## Scope retained

The slice did not add:

- AI hints or generated answers;
- code execution;
- mistake taxonomy, scoring or analytics;
- retry scheduling or spaced repetition;
- authentication, backend, cloud database or sync;
- dashboard, gamification, router or component library.

## Automated evidence

The implementation passed:

- deterministic scope guard;
- reflection validation and update tests;
- schema-v1 migration and schema-v2 persistence tests;
- edit-without-duplicate tests;
- TypeScript and Vite production build;
- Playwright add, reload and edit reflection flow;
- plain-text safety proof;
- required Pixel 7 screenshot evidence.

Relevant successful runs:

- `30228865620`
- `30229006358`

Final screenshot artifact: `8639463916`.

## Owner acceptance

The owner asked where the reflection text came from. The implementation clarified that all exercise, attempt, mistake and lesson content is entered manually; no AI generates or fills those fields.

After that clarification, the owner said to continue. This is recorded as acceptance of the bounded JPL-002 slice on `2026-07-27`.

Acceptance confirms the interaction is satisfactory. It does not prove that reflection improves learning outcomes.

## Next decision

JPL-003 is active, but fixed review scheduling is not justified yet. The retry slice therefore uses a manual review queue:

1. explicitly mark a reflected attempt as needing another try;
2. start a fresh attempt while prior work is hidden;
3. submit the fresh attempt;
4. reveal previous work for comparison.

Fixed intervals, due dates, notifications and spaced-repetition scoring remain deferred until at least five real retries provide evidence.
