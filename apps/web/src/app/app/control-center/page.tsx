import Link from "next/link";
import { ControlCenterClient } from "./control-center-client";

export default function ControlCenterPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <Link href="/app" className="text-xs text-muted transition-colors hover:text-accent">
          ← CycleWarden home
        </Link>
      </div>
      <ControlCenterClient />
    </div>
  );
}
