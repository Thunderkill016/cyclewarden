import { ForgeStartShell } from "@/components/forge/forge-start-shell";
import { getForgeActor } from "@/lib/forge/actor";
import { listForgeRepositories } from "@/lib/forge/repositories";

export default async function ForgeStartPage() {
  const [actor, repositories] = await Promise.all([
    getForgeActor(),
    listForgeRepositories(),
  ]);

  return (
    <ForgeStartShell
      actor={{ displayName: actor.displayName, demo: actor.demo }}
      repositories={repositories}
    />
  );
}
