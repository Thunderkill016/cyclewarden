import type { RiskLevel } from "../contracts/index.js";

export type SensitiveActionReason =
  | "production_deployment"
  | "destructive_data_change"
  | "protected_branch_write"
  | "secret_access"
  | "unrestricted_network_access"
  | "privilege_expansion"
  | "budget_increase";

export interface RequestedAction {
  operation: string;
  productionDeployment?: boolean;
  destructiveDataChange?: boolean;
  protectedBranchWrite?: boolean;
  secretAccess?: boolean;
  unrestrictedNetworkAccess?: boolean;
  privilegeExpansion?: boolean;
  budgetIncrease?: boolean;
}

export interface ApprovalClassification {
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  reasons: SensitiveActionReason[];
}

const REASON_PRIORITY: ReadonlyArray<{
  reason: SensitiveActionReason;
  key: keyof RequestedAction;
  risk: RiskLevel;
}> = [
  { reason: "production_deployment", key: "productionDeployment", risk: "critical" },
  { reason: "destructive_data_change", key: "destructiveDataChange", risk: "critical" },
  { reason: "protected_branch_write", key: "protectedBranchWrite", risk: "high" },
  { reason: "secret_access", key: "secretAccess", risk: "high" },
  { reason: "unrestricted_network_access", key: "unrestrictedNetworkAccess", risk: "high" },
  { reason: "privilege_expansion", key: "privilegeExpansion", risk: "high" },
  { reason: "budget_increase", key: "budgetIncrease", risk: "medium" },
];

const RISK_SCORE: Readonly<Record<RiskLevel, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function classifyRequestedAction(
  action: RequestedAction,
): ApprovalClassification {
  const matched = REASON_PRIORITY.filter(({ key }) => action[key] === true);
  const riskLevel = matched.reduce<RiskLevel>(
    (highest, current) =>
      RISK_SCORE[current.risk] > RISK_SCORE[highest] ? current.risk : highest,
    "low",
  );

  return {
    requiresApproval: matched.length > 0,
    riskLevel,
    reasons: matched.map(({ reason }) => reason),
  };
}
