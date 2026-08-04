import { getAuth, getAuthAdapterName } from "@/lib/auth";

export interface ForgeActor {
  id: string;
  email: string | null;
  displayName: string;
  demo: boolean;
}

export class ForgeAuthenticationError extends Error {
  readonly code = "UNAUTHORIZED" as const;

  constructor() {
    super("Authentication is required to access Atoryn Forge");
    this.name = "ForgeAuthenticationError";
  }
}

export async function getForgeActor(): Promise<ForgeActor> {
  const user = await getAuth().getUser();
  if (user) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.name ?? user.email?.split("@")[0] ?? "Developer",
      demo: false,
    };
  }

  if (getAuthAdapterName() === "none") {
    return {
      id: "demo-forge-user",
      email: "demo@atoryn.local",
      displayName: "Demo developer",
      demo: true,
    };
  }

  throw new ForgeAuthenticationError();
}
