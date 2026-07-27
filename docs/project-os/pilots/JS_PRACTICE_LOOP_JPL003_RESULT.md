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

The final lifecycle runs `30232985689` and `30232985685` also passed with JPL-003 in `verify` state.

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
- fresh-retry and comparison mobile screenshots in artifact `8640690757`.

## Defect found through use

The first browser run found that a stale reflection success message took precedence over the retry success message. The implementation now clears stale status when changing workflow and prioritizes the active retry result. The successful run was completed only after that fix.

## Owner acceptance

The owner reviewed the fresh-retry and comparison states and responded `OK` on 2026-07-27.

JPL-003 is therefore `done`. This acceptance confirms the bounded interaction is satisfactory; it does not prove learning effectiveness or justify an automatic review schedule.

## Evidence hold

There is currently no active implementation task.

JPL-004 remains blocked even though its dependency is complete. Its proposed mistake-history design requires observations from at least five real JavaScript exercises. Until that evidence exists, CycleWarden must not invent labels, grouping, scoring or analytics merely to keep development moving.

The next valid action is real use of the accepted loop, followed by one of three explicit decisions:

1. activate a bounded JPL-004 supported by observed repeated mistakes;
2. reshape JPL-004 around what the evidence actually shows;
3. drop JPL-004 if the history view is unnecessary.
