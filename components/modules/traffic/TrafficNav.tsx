"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  History, 
  Settings, 
  LogOut, 
  Shield,
  Activity,
  TrafficCone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TrafficNavProps {
  user: any;
}

export function TrafficNav({ user }: TrafficNavProps) {
  const pathname = usePathname();

  const menuItems = [
    { icon: LayoutDashboard, label: "Live Dashboard", href: "/traffic/dashboard" },
    { icon: MapIcon, label: "Junction Map", href: "/traffic/map" },
    { icon: History, label: "Clearance Logs", href: "/traffic/history" },
    { icon: Settings, label: "System Config", href: "/traffic/settings" },
  ];

  if (pathname === "/traffic/login") return null;

  return (
    <div className="w-80 bg-white border-r border-slate-100 flex flex-col h-full shadow-sm">
      <div className="p-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <TrafficCone className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">JEEVAN SETU</h2>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Traffic Portal</p>
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
              pathname === item.href
                ? "bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-600/5"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            )}
          >
            <item.icon className={cn(
              "h-5 w-5 transition-transform group-hover:scale-110",
              pathname === item.href ? "text-emerald-600" : "text-slate-400"
            )} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-50">
        <div className="bg-slate-50 p-6 rounded-3xl mb-4 group transition-all hover:bg-emerald-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm group-hover:border-emerald-100">
              <Shield className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Junction</p>
              <p className="text-sm font-black text-slate-800 line-clamp-1">{user.metadata?.junctionName || "Silk Board Junc"}</p>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          onClick={() => signOut({ callbackUrl: "/traffic/login" })}
          className="w-full h-14 rounded-2xl flex items-center justify-center gap-4 text-slate-400 font-bold hover:bg-red-50 hover:text-red-500 transition-all"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
