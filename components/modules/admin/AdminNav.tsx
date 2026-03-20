"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BarChart3, Shield, Activity, MapPin, LogOut, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AdminNavProps {
  user: any;
}

export function AdminNav({ user }: AdminNavProps) {
  const pathname = usePathname();

  const menuItems = [
    { icon: BarChart3, label: "Dashboard", href: "/admin/dashboard" },
    { icon: Activity, label: "Incidents", href: "/admin/incidents" },
    { icon: Brain, label: "AI Learning", href: "/admin/ai-learning" },
  ];

  return (
    <div className="w-72 bg-white border-r border-slate-100 flex flex-col h-full shadow-sm">
      <div className="p-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">JEEVAN SETU</h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Admin Console</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-4 px-6 h-14 rounded-2xl font-bold transition-all group",
              pathname.startsWith(item.href)
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            )}
          >
            <item.icon className="h-5 w-5 transition-transform group-hover:scale-110" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-50">
        <div className="bg-slate-50 p-4 rounded-2xl mb-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Signed in as</p>
          <p className="text-sm font-black text-slate-800">{user?.name || "Admin"}</p>
        </div>
        <Button
          variant="ghost"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full h-12 rounded-2xl flex items-center justify-center gap-3 text-slate-400 font-bold hover:bg-red-50 hover:text-red-500 transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
