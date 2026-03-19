import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TrafficNav } from "@/components/modules/traffic/TrafficNav";
import { AlertManager } from "@/components/modules/traffic/AlertManager";

export default async function TrafficLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Protect traffic routes - only allow traffic_police
  if (!session || session.user.role !== "traffic_police") {
    // If it's the login page, allow it
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <TrafficNav user={session.user} />
      <main className="flex-1 overflow-y-auto w-full relative">
        {children}
      </main>
      <AlertManager junctionId={session.user.id} />
    </div>
  );
}
