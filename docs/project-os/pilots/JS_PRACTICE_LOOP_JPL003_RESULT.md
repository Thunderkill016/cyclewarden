# JS Practice Loop — JPL-003 implementation result

## Starting contract

JPL-003 tests one learning behavior: the learner retries a reflected JavaScript exercise before seeing their previous attempt, mistake or lesson.

## Product decision

The slice uses a manual review queue. The learner explicitly marks an attempt as needing another try.

Fixed intervals, due dates, notifications and spaced-repetition scoring remain deferred because the pilot does not yet have enough real retry evidence to justify scheduling.

## Implementation

The local-only app now supports:

1. marking a reflected attempt as needing another try;
2. opening a fresh retry state that shows only the exercise;
3. keeping the original attempt and reflection out of the DOM during retry;
4. requiring a non-empty new attempt;
5. appending the retry to the existing record;
6. revealing prior material after submission for comparison;
7. preserving retry history after reload.

## Data compatibility

- schema version 1 attempts still load;
- schema version 2 reflection records still load;
- new writes use schema version 3;
- retry state and retry history are optional;
- malformed or incompatible records fail closed.

## Scope retained

The slice did not add:

- AI hints, generated answers or grading;
- code execution;
- review scheduling, due dates or notifications;
- mistake taxonomy, scoring, analytics, streaks or gamification;
- authentication, backend, cloud database or sync;
- JPL-004 grouping/history behavior.

## Automated evidence

AI workflow check run `30232806679` and JS Practice Loop run `30232806674` passed on head `2859b7b9138124e5c29bc9f9f9e7d17ce6415d08`.

Evidence includes:

- deterministic scope guard;
- retry validation and append tests;
- schema-v2 to schema-v3 migration tests;
- no-duplicate persistence tests;
- TypeScript and Vite production build;
- browser proof that previous work is absent during a fresh retry;
- empty retry validation;
- save, reveal, comparison and reload persistence;
- inert plain-text handling for attempt, reflection and retry content;
- fresh-retry and comparison mobile screenshots in artifact `8640638887`.

## Defect found through use

The first browser run found that a stale reflection success message took precedence over the retry success message. The implementation now clears stale status when changing workflow and prioritizes the active retry result. The successful run was completed only after that fix.

## Current lifecycle state

JPL-003 is `verify`, not `done`.

The remaining gate is owner review of:

- the state where previous work is hidden;
- the state where prior work and the fresh retry are shown together.

JPL-004 remains blocked. It also requires evidence from at least five real exercises, so JPL-003 acceptance alone does not justify implementing analytics or grouping immediately.
