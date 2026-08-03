import { describe, expect, it } from "vitest";

import type { SourceProvider } from "@cyclewarden/forge-domain";

export function defineSourceProviderContract(
  name: string,
  createProvider: () => SourceProvider,
): void {
  describe(`${name} source provider contract`, () => {
    it("lists, resolves, and publishes a draft change request", async () => {
      const provider = createProvider();
      const listed = await provider.listRepositories({ connectionId: "connection" });
      expect(listed.repositories.length).toBeGreaterThan(0);
      const repository = listed.repositories[0];
      expect(repository).toBeDefined();
      const resolved = await provider.resolveRepository({
        connectionId: "connection",
        externalRepositoryId: repository!.externalRepositoryId,
      });
      const publication = await provider.createDraftChangeRequest({
        repository: resolved,
        baseBranch: resolved.defaultBranch,
        branchName: "atoryn/test",
        commitMessage: "test: change",
        title: "Test change",
        body: "Fixture",
        draft: true,
        expectedHeadSha: "abc123",
      });
      expect(publication.status).toBe("pr_created");
      expect(publication.branchName).toBe("atoryn/test");
    });
  });
}
