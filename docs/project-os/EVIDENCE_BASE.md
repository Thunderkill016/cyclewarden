# CycleWarden Project OS evidence base

Status: active design input for the assessment-gate pilot

CycleWarden must not turn an AI-generated opinion into project truth. This document records the external methods, real pilot evidence, and product rules that support the Project OS design.

## Evidence classes

CycleWarden distinguishes four kinds of input:

1. **Product evidence** — observations about the specific problem or project: owner/user observations, user research, repository evidence, analytics, support logs, or a real experiment.
2. **Existing-solution evidence** — what current products or manual workflows already do and where they fail.
3. **Method guidance** — external knowledge about how to run discovery, shaping, delivery, or evaluation.
4. **Inference** — an AI or human interpretation that has not yet been observed or tested.

Method guidance can define a good process. It cannot prove that a particular product should exist. Inference may generate a research question, but it cannot unlock implementation by itself.

## External method sources

### GOV.UK Service Manual — discovery before commitment

Sources:

- https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works
- https://www.gov.uk/service-manual/user-research/user-research-in-discovery
- https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs
- https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service

Relevant experience encoded by these guides:

- understand the problem before committing to build;
- learn who users are, what they are trying to achieve, how they do it now, and what frustrates them;
- review existing evidence and related services;
- turn unsupported opinions into research questions;
- choose research activities that provide reliable answers for the least time, effort, and cost;
- consider alternatives to building a new service;
- decide whether the expected improvement is cost effective;
- treat a decision to stop after discovery as a valid outcome, not a delivery failure.

CycleWarden rule derived from this source:

> A greenfield project starts in assessment. Implementation is locked until the evidence supports an explicit `build` decision.

### Shape Up — problem, appetite, no-gos, and bets

Sources:

- https://basecamp.com/shapeup/1.2-chapter-03
- https://basecamp.com/shapeup/1.5-chapter-06
- https://basecamp.com/shapeup/2.3-chapter-09

Relevant experience encoded by Shape Up:

- separate the problem from the proposed solution;
- ask whether the problem matters before judging a solution;
- set an appetite before expanding scope;
- name rabbit holes and no-gos;
- make a deliberate bet rather than treating every idea as backlog work.

CycleWarden rules derived from this source:

- a build assessment records the problem, appetite, success measure, risks, and exclusions;
- `build` is an explicit owner decision, not the default state;
- scope is bounded after the decision, not used to justify the decision retroactively.

### Anthropic — use the simplest sufficient agentic system

Sources:

- https://www.anthropic.com/engineering/building-effective-agents
- https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents

Relevant experience encoded by these guides:

- start with the simplest solution possible;
- do not add an agentic framework when a simpler prompt or workflow is enough;
- add complexity only when it demonstrably improves outcomes;
- use evaluations to make failures and behavioral changes visible before production.

CycleWarden rules derived from this source:

- prefer an existing product, manual workflow, repository convention, or simple script when it is sufficient;
- CycleWarden itself must remain a deterministic local layer until evidence justifies more automation;
- each retained capability needs a real task or regression test, not an architectural story.

### OpenAI — specify, measure, improve under real conditions

Sources:

- https://openai.com/index/evals-drive-next-chapter-of-ai/
- https://openai.com/index/trustworthy-third-party-evaluations-foundations/

Relevant experience encoded by these sources:

- define what good means before evaluation;
- measure behavior in conditions that represent actual use;
- improve from observed failures rather than from confidence in the design;
- agent performance depends on the environment and workflow, not only the model.

CycleWarden rules derived from this source:

- a project assessment records success measures and kill criteria before implementation;
- a task cannot be accepted solely because code exists or tests are green;
- pilot results must distinguish technical workflow success from product usefulness.

### GitHub Spec Kit — boundary with feature-level specification

Sources:

- https://github.github.io/spec-kit/
- https://github.github.io/spec-kit/concepts/spec-of-specs.html
- https://github.github.io/spec-kit/concepts/complex-features.html

Relevant experience encoded by Spec Kit:

- structured `spec → plan → tasks → implement` artifacts help coding agents preserve intent;
- stable IDs, dependency-aware slices, and bounded implementation runs reduce context loss;
- decomposition adds overhead and should be used only when lighter approaches are insufficient.

CycleWarden boundary derived from this source:

> CycleWarden decides whether work should exist and which project-level initiative is valid. It should integrate with, rather than reimplement, mature feature-level specification and implementation workflows.

## Real pilot evidence

### MoneyFlow brownfield pilot

Observed results:

- repository and issue evidence exposed a real readiness dependency;
- a later redesign issue was not allowed to replace unfinished readiness work;
- an owner decision to drop an unnecessary seven-day gate was preserved without falsely marking it complete;
- deterministic `status`, `next`, and dependency validation added useful continuity across sessions.

Supported CycleWarden capabilities:

- recover project truth from repository evidence;
- preserve owner decisions;
- keep one current task;
- select work by dependency rather than recency or size.

### JS Practice Loop greenfield pilot

Observed results:

- shaping, bounded delivery, migration, browser evidence, and owner gates worked technically;
- the coding workflow found and fixed a real stale-status defect;
- the owner still judged the resulting product insufficiently useful compared with freeCodeCamp plus a Markdown or notes workflow;
- the no-code alternative was not tested before implementation.

Conclusion:

```text
Technical delivery workflow: PASS
Product usefulness: FAIL
Decision: STOP
```

Supported CycleWarden change:

- add a build-or-not gate before shaping and implementation;
- allow `use-existing`, `manual`, and `stop` as successful project outcomes;
- do not treat external method citations or AI reasoning as evidence of product demand.

## Traceability rule

Every new CycleWarden rule must name at least one of:

- external method source;
- target-repository evidence;
- owner/user observation;
- real experiment or failure;
- regression test derived from a real failure.

A rule with none of these is a hypothesis. It must be labelled as such and must not become a mandatory gate until tested.
