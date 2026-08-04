# Phase 8 evidence — bilingual workflow

Implemented tasks T066–T070 on `agent/atoryn-forge-bilingual-workflow`.

## Delivered

- Forge-specific Vietnamese and English namespaces under `packages/i18n/locales/forge/`.
- Independent `interfaceLocale`, `instructionLanguage`, and `technicalOutputLanguage` state and persistence.
- Deterministic normalization that preserves the original instruction while producing a technical-output-language control envelope.
- Instruction trace cards on both the live run audit surface and evidence-review surface.
- Unit coverage proving interface switching does not mutate instruction or technical-output language.
- Authenticated Playwright coverage using a Vietnamese task, English interface switch, English normalized artifact policy, rejection, next iteration, approval, and fake draft pull-request publication.

## Acceptance target

Vietnamese task input remains visible as authoritative source context while branch, commit, pull-request copy, and technical summaries are governed by the separately selected English technical-output language.

Validation results are recorded in the Phase 8 pull request before merge.
