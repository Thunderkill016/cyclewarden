# JS Practice Loop — CycleWarden greenfield pilot

This fixture tests whether CycleWarden can turn a vague personal idea into a bounded project start without inventing a large platform.

## Starting idea

> Build something that helps the owner learn programming better instead of asking AI to solve every exercise.

## Product decision

Do not build another curriculum, flashcard platform, AI tutor or browser IDE.

Build a private local practice loop:

```text
exercise prompt
→ learner writes their own attempt
→ solved or stuck
→ save
→ reload and recover the same record
```

The later mistake-reflection and review slices are blocked until this first flow is accepted.

## Foundation decision

- React + TypeScript through Vite.
- Plain CSS and semantic HTML; no component library yet.
- Versioned localStorage behind a storage interface.
- No backend, cloud database, authentication or AI provider.
- Vitest for domain/storage tests and Playwright for the core browser flow.
- Static deployment is deferred until local behavior is verified.

## Current result

```text
JPL-000 product shaping                         done
JPL-001 create + save + reload one attempt      active
→ JPL-002 mistake reflection                    blocked
→ JPL-003 retry due mistake                     blocked
→ JPL-004 repeated-mistake history              blocked
→ JPL-005 backup export/import                  blocked
```

`cw next` must return `JPL-001`.

## Why this is a useful CW test

The original request contains many temptations for an AI coding agent:

- choose a fashionable full-stack framework;
- add accounts and a database;
- integrate an AI tutor;
- create a course catalog;
- build code execution;
- design dashboards and streaks.

The greenfield contract rejects those choices until a repeated need appears. The first slice is useful by itself and can be tested end to end.

## Kill criteria

Stop or simplify if:

- the owner does not record five real exercises;
- the first slice expands beyond local-only storage;
- the product mainly duplicates an existing course or flashcard tool;
- the implementation introduces AI answer generation and recreates the original learning problem.

## Safety

Store exercise prompts and learner attempts as plain text. Never execute submitted code, render it as HTML, or store secrets in browser data.
