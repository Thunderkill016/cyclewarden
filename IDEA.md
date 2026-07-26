# CycleWarden historical platform vision

Status: archived as an active product direction on 2026-07-26

Active scope: [`PRACTICAL_SCOPE.md`](PRACTICAL_SCOPE.md)  
Active validation: [issue #57](https://github.com/Thunderkill016/cyclewarden/issues/57)  
Superseded platform roadmap: closed issue #9

## Why this document changed

CycleWarden was previously defined as one integrated AI-native product development system spanning product discovery, research, agent execution, verification, release, deployment, measurement, learning and interoperability.

That vision produced substantial technical work, but it expanded faster than evidence that the system improved real project delivery. The broad vision is therefore preserved as research history rather than treated as the current destination.

Git history and closed issue #9 retain the detailed former requirements.

## Historical product promise

The former vision was:

> Give CycleWarden a product objective and repository. CycleWarden understands the current system, researches what should happen next, builds the selected change through governed agents, verifies and ships it safely, measures the result, and uses accepted evidence to improve future cycles.

The proposed integrated lifecycle was:

```text
idea and product definition
→ repository and product understanding
→ internal and external research
→ opportunity and experiment selection
→ agent-assisted implementation
→ independent verification
→ release and deployment
→ product-outcome measurement
→ retained learning
```

The corresponding platform modules included:

- Product Workspace and application foundation;
- Evolution Kernel;
- Research Intelligence;
- Execution and Sandbox;
- Verification and Evidence;
- Delivery and Operations;
- Learning and Improvement;
- GitHub, MCP and A2A interoperability.

## What remains valid

Several principles from the former vision still guide the practical workflow:

1. Coding agents are workers; they do not own final authorization or acceptance.
2. A task should have explicit scope and acceptance criteria.
3. Implementation should occur in an isolated Git context.
4. The implementer should not be the only verifier.
5. Passing tests proves technical compatibility, not product value.
6. Claims about improvement require evidence from later real tasks.

## What is no longer assumed

CycleWarden no longer assumes that it must:

- own the complete product lifecycle;
- provide every application-foundation module;
- conduct broad product research;
- support multiple interchangeable agents;
- build a hosted multi-user platform;
- deploy, roll back or operate production systems;
- measure product outcomes automatically;
- implement recursive learning;
- expose MCP or A2A interfaces.

Any of these capabilities may be reconsidered only when repeated real task evidence demonstrates a material need.

## Current direction

CycleWarden now tests a smaller hypothesis:

```text
real task
→ bounded context and scope
→ existing coding agent
→ independent verification
→ human merge decision
```

The repository will keep only the parts that prove useful in six real tasks. If direct coding-agent use performs as well or better, CycleWarden will remain a research prototype rather than continue toward the historical platform vision.
