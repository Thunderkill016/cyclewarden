export type ForgeRepositoryStatus = "active" | "archived" | "revoked";

export interface ForgeRepositoryOption {
  id: string;
  provider: "fake-source";
  namespace: string;
  name: string;
  defaultBranch: string;
  status: ForgeRepositoryStatus;
  supported: boolean;
  description: string;
}

const REPOSITORIES: readonly ForgeRepositoryOption[] = [
  {
    id: "fixture-nextjs",
    provider: "fake-source",
    namespace: "atoryn-fixtures",
    name: "nextjs-app",
    defaultBranch: "main",
    status: "active",
    supported: true,
    description: "JavaScript/TypeScript fixture used by the provider-neutral MVP.",
  },
  {
    id: "fixture-archived",
    provider: "fake-source",
    namespace: "atoryn-fixtures",
    name: "archived-app",
    defaultBranch: "main",
    status: "archived",
    supported: false,
    description: "Archived repositories cannot start a run.",
  },
  {
    id: "fixture-revoked",
    provider: "fake-source",
    namespace: "atoryn-fixtures",
    name: "revoked-connection",
    defaultBranch: "main",
    status: "revoked",
    supported: false,
    description: "Connection revoked; reconnect before starting a run.",
  },
];

export async function listForgeRepositories(): Promise<ForgeRepositoryOption[]> {
  return REPOSITORIES.map((repository) => ({ ...repository }));
}

export function resolveForgeRepository(repositoryId: string): ForgeRepositoryOption | null {
  const repository = REPOSITORIES.find((item) => item.id === repositoryId);
  return repository ? { ...repository } : null;
}
