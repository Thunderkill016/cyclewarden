import type {
  AcceptanceEvidence,
  ReviewDecision,
  ValidationResult,
} from "../contracts/index.js";

export type CompletionBlockerCode =
  | "STALE_EVIDENCE_SNAPSHOT"
  | "MANDATORY_VALIDATION_FAILED"
  | "MANDATORY_EVIDENCE_MISSING"
  | "INVALID_EVIDENCE_WAIVER"
  | "REVIEW_NOT_APPROVED";

export interface CompletionBlocker {
  code: CompletionBlockerCode;
  key: string;
  message: string;
}

export interface CompletionGateResult {
  eligibleForApproval: boolean;
  eligibleForPublication: boolean;
  blockers: CompletionBlocker[];
}

const MANDATORY_REQUIREMENTS = new Set([
  "constitution",
  "task_mandatory",
]);

function isMandatory(requirement: string): boolean {
  return MANDATORY_REQUIREMENTS.has(requirement);
}

function hasCompleteAdvisoryWaiver(evidence: AcceptanceEvidence): boolean {
  return Boolean(
    evidence.waivedBy && evidence.waivedReason && evidence.waivedAt,
  );
}

export function isEvidenceSnapshotStale(input: {
  evidenceSnapshotVersion: number;
  currentSnapshotVersion: number;
}): boolean {
  return input.evidenceSnapshotVersion !== input.currentSnapshotVersion;
}

export function evaluateCompletionGate(input: {
  currentSnapshotVersion: number;
  validations: ValidationResult[];
  acceptanceEvidence: AcceptanceEvidence[];
  reviewDecision?: ReviewDecision;
}): CompletionGateResult {
  const blockers: CompletionBlocker[] = [];

  for (const validation of input.validations) {
    if (isMandatory(validation.requirement) && validation.status !== "passed") {
      blockers.push({
        code: "MANDATORY_VALIDATION_FAILED",
        key: validation.id,
        message: `Mandatory ${validation.kind} validation is ${validation.status}`,
      });
    }
  }

  for (const evidence of input.acceptanceEvidence) {
    if (isMandatory(evidence.requirement)) {
      if (evidence.status !== "satisfied") {
        blockers.push({
          code:
            evidence.status === "waived"
              ? "INVALID_EVIDENCE_WAIVER"
              : "MANDATORY_EVIDENCE_MISSING",
          key: evidence.criterionKey,
          message: `Mandatory evidence ${evidence.criterionKey} is ${evidence.status}`,
        });
      }
      continue;
    }

    if (evidence.status === "waived" && !hasCompleteAdvisoryWaiver(evidence)) {
      blockers.push({
        code: "INVALID_EVIDENCE_WAIVER",
        key: evidence.criterionKey,
        message: `Advisory waiver ${evidence.criterionKey} is missing audit fields`,
      });
    }
  }

  const eligibleForApproval = blockers.length === 0;
  const reviewDecision = input.reviewDecision;

  if (reviewDecision) {
    if (
      isEvidenceSnapshotStale({
        evidenceSnapshotVersion: reviewDecision.evidenceSnapshotVersion,
        currentSnapshotVersion: input.currentSnapshotVersion,
      })
    ) {
      blockers.push({
        code: "STALE_EVIDENCE_SNAPSHOT",
        key: reviewDecision.id,
        message: "The reviewed evidence snapshot is stale",
      });
    }

    if (reviewDecision.decision !== "approved") {
      blockers.push({
        code: "REVIEW_NOT_APPROVED",
        key: reviewDecision.id,
        message: `Review decision is ${reviewDecision.decision}`,
      });
    }
  }

  return {
    eligibleForApproval,
    eligibleForPublication:
      eligibleForApproval && Boolean(reviewDecision) && blockers.length === 0,
    blockers,
  };
}
