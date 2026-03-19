import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { HospitalNav } from "@/components/modules/hospital/HospitalNav";

export default async function HospitalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Protect hospital routes - only allow hospital_staff
  if (!session || session.user.role !== "hospital_staff") {
    // If it's the login page, allow it
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <HospitalNav user={session.user} />
      <main className="flex-1 overflow-y-auto w-full relative">
        {children}
      </main>
    </div>
  );
}
