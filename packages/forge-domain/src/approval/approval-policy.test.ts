import { describe, expect, it } from "vitest";

import { classifyRequestedAction } from "./approval-policy.js";

describe("approval policy", () => {
  it("does not require approval for a bounded ordinary command", () => {
    expect(classifyRequestedAction({ operation: "pnpm test" })).toEqual({
      requiresApproval: false,
      riskLevel: "low",
      reasons: [],
    });
  });

  it("requires approval for every constitutional sensitive category", () => {
    const result = classifyRequestedAction({
      operation: "deploy and migrate",
      productionDeployment: true,
      destructiveDataChange: true,
      protectedBranchWrite: true,
      secretAccess: true,
      unrestrictedNetworkAccess: true,
      privilegeExpansion: true,
      budgetIncrease: true,
    });

    expect(result.requiresApproval).toBe(true);
    expect(result.riskLevel).toBe("critical");
    expect(result.reasons).toEqual([
      "production_deployment",
      "destructive_data_change",
      "protected_branch_write",
      "secret_access",
      "unrestricted_network_access",
      "privilege_expansion",
      "budget_increase",
    ]);
  });
});
