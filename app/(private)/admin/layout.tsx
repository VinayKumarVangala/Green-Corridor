import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/modules/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session || session.user.role !== "admin") {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <AdminNav user={session.user} />
      <main className="flex-1 overflow-y-auto w-full relative">{children}</main>
    </div>
  );
}
