export interface WorkspaceAuthorizer {
  assertCanAccess(input: { workspaceId: string; userId: string }): Promise<void>;
}

export class StaticWorkspaceAuthorizer implements WorkspaceAuthorizer {
  constructor(
    private readonly allowed: ReadonlySet<string>,
  ) {}

  async assertCanAccess(input: {
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    const key = `${input.workspaceId}:${input.userId}`;
    if (!this.allowed.has(key)) {
      const error = new Error("UNAUTHORIZED");
      error.name = "UNAUTHORIZED";
      throw error;
    }
  }
}
