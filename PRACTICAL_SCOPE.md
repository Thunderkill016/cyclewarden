# CycleWarden practical scope

Status: active product direction

Tracking issue: #57

## Purpose

CycleWarden is currently an experimental local workflow for a solo developer using coding agents on real repositories.

Its job is limited to four outcomes:

1. prepare a bounded task with relevant repository context;
2. run or hand off implementation in an isolated Git branch or worktree;
3. verify scope, tests and changed files independently from the implementer;
4. produce enough evidence for a human to decide whether to merge.

CycleWarden is not currently being developed as a complete AI engineering platform, hosted SaaS, deployment system or autonomous product manager.

## Active workflow

```text
real project task
→ bounded context and acceptance criteria
→ coding agent implementation
→ test / lint / typecheck / build
→ scope and patch verification
→ human merge decision
```

Existing internal mechanisms may support this workflow, but they are not independent product goals.

## Practical validation

The current phase compares six real tasks:

- three completed through the normal coding-agent workflow;
- three comparable tasks completed with CycleWarden assistance.

Fixtures, synthetic examples and work created only to exercise CycleWarden do not count.

Every task must record:

- preparation time;
- implementation retries;
- scope escapes;
- failures found before review;
- human review time;
- tool-specific friction;
- final result.

Use [`docs/practical/TASK_RECORD_TEMPLATE.md`](docs/practical/TASK_RECORD_TEMPLATE.md) for each task.

## Allowed development

During practical validation, CycleWarden code may change only when:

- a real task cannot proceed because of a concrete defect;
- a repeated manual step is observed in multiple real tasks;
- the change is the smallest way to test a specific value hypothesis.

Every runtime change must link to the real task that exposed the need.

## Frozen areas

The following work is frozen until task evidence justifies re-entry:

- multi-project web dashboards;
- deployment, release and rollback automation;
- outcome analytics and recursive learning;
- MCP and A2A integration;
- multi-user or hosted SaaS capabilities;
- additional coding-agent adapters;
- additional sandbox backends;
- broad research-provider expansion;
- persistence hardening unrelated to a task-blocking defect;
- architecture work justified only by completeness.

Frozen code remains in the repository as technical and research evidence. It is not deleted or represented as the active roadmap.

## Decision after six tasks

- Keep `prepare` if it materially improves task clarity or context recovery.
- Keep execution orchestration only if it reduces repeated manual effort without adding comparable friction.
- Keep `verify` if it catches meaningful errors or makes merge decisions clearer.
- Freeze the repository as a research prototype if direct coding-agent use performs as well or better.

No broader roadmap resumes without observed, repeated need from real project work.
