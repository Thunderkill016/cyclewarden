# JS Practice Loop — product outcome

## Decision

```text
Technical delivery workflow: PASS
Product usefulness: FAIL
Decision: STOP
```

The owner judged the JS Practice Loop application insufficiently useful in practice. The accepted implementation slices prove that CycleWarden can bound work, preserve dependencies, collect evidence, stop for owner review and surface defects. They do not justify continuing the product.

## Why the product stopped

- freeCodeCamp already provides JavaScript exercises and a learning sequence;
- a Markdown file or existing notes tool can capture attempts and mistakes with lower friction;
- the application requires repeated manual entry into a separate workflow;
- no five-exercise manual test established that the behaviour was valuable before coding;
- no evidence showed that a custom application improved learning enough to justify maintenance.

## Process failure discovered

CycleWarden began at shaping and delivery:

```text
idea → shape → decide stack → roadmap → implement
```

It failed to ask the more important question first:

```text
idea → should this be built at all?
```

A disciplined workflow can otherwise produce an unnecessary product efficiently.

## Required CycleWarden change

Every new project must start with a build-or-not assessment covering:

1. frequency and cost of the real problem;
2. current workaround;
3. existing products and simpler alternatives;
4. a no-code or manual test;
5. usage and maintenance cost;
6. an explicit decision: `pending`, `build`, `use-existing`, `manual`, or `stop`;
7. kill criteria.

No implementation task may become `ready`, `active`, or `verify` unless the assessment decision is `build`.

## What is retained

The JPL branches and CI evidence remain historical technical proof. They are not a product roadmap and must not be merged as a product feature. JPL-004 and JPL-005 are abandoned.
