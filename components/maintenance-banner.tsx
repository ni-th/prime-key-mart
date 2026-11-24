import Link from "next/link";
import { Wrench } from "lucide-react";
import { auth } from "@/lib/auth";
import { readMaintenance } from "@/lib/maintenance";

/**
 * Red strip while maintenance mode is on, for admins only (customers are
 * shown the maintenance page instead), so it's never left on by accident.
 */
export async function MaintenanceBanner() {
  const [session, maintenance] = await Promise.all([
    auth(),
    readMaintenance().catch(() => ({ on: false })),
  ]);
  if (!maintenance.on || session?.user?.role !== "ADMIN") return null;

  return (
    <div className="bg-destructive px-4 py-2 text-center text-sm font-medium text-white">
      <Wrench className="mr-1.5 inline size-4 align-text-bottom" />
      Maintenance mode is ON: customers see the maintenance page and can&apos;t order.{" "}
      <Link href="/admin/settings" className="underline underline-offset-4">
        Turn it off
      </Link>
    </div>
  );
}
