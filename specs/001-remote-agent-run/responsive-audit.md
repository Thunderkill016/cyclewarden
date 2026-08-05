# Atoryn Forge responsive audit

**Audited**: 2026-08-05  
**Scope**: authenticated Forge start, live run controls, event activity, approvals, and evidence review  
**Viewports**: 320/390 px mobile, 768 px tablet, 1280/1440 px desktop

## Acceptance matrix

| Surface | Mobile | Tablet | Desktop | Findings and remediation |
|---|---|---|---|---|
| Repository selector | Pass | Pass | Pass | Long namespace/repository names now break safely; cards and radio controls have explicit minimum dimensions and overflow containment. |
| Task composer | Pass | Pass | Pass | Textarea and language selectors use mobile-safe font sizing, touch-sized controls, and min-width containment. |
| Run summary and identifiers | Pass | Pass | Pass | Existing `min-w-0`, `break-words`, and `break-all` handling preserves long run IDs and repository identities. |
| Ordered activity feed | Pass | Pass | Pass | Event rows now use `minmax(0,1fr)`, overflow containment, wrapped titles/details, and breakable provider event identifiers. |
| Mobile command center | Pass | Pass | Pass | Status and approval content wrap; text input avoids mobile zoom; action buttons meet a minimum 44 px target; approval controls collapse below 360 px. |
| Approval controls | Pass | Pass | Pass | Long scope summaries wrap and action controls remain individually reachable without horizontal scrolling. |
| Unified diff review | Pass | Pass | Pass | Diff intentionally scrolls within a bounded container while surrounding metadata wraps and remains visible. |
| Global navigation/focus | Pass | Pass | Pass | Root overflow is clipped, viewport supports safe areas, focus rings are visible, touch manipulation is explicit, and reduced-motion preferences are respected. |

## Regression evidence

`apps/web/src/components/forge/responsive-hardening.test.tsx` renders long repository names, provider event identifiers, approval summaries, task controls, and mobile command actions. It asserts the overflow-containment, wrapping, narrow-grid, mobile-font, and touch-target classes that protect the audited surfaces.

Existing authenticated Playwright coverage still verifies the complete Forge start flow, cross-context mobile recovery/control flow, and evidence-review flow. The repository CI additionally runs demo and PostgreSQL-backed browser acceptance.

## Installability boundary

`apps/web/src/app/manifest.ts` and root metadata make Atoryn Forge installable as a standalone web application. This is an installability claim only. No service worker or offline run execution is declared: authentication, event recovery, provider operations, approvals, and publication require connectivity.

## Result

No known horizontal-overflow, inaccessible-focus, or undersized-primary-action defect remains in the audited Forge surfaces. Any later component that displays provider-controlled identifiers must preserve the same `min-w-0`, wrapping, and bounded-scroll conventions.
