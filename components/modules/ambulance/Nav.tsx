"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    History,
    Settings,
    LogOut,
    User,
    Truck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/ambulance/dashboard" },
    { label: "Job History", icon: History, href: "/ambulance/history" },
    { label: "Settings", icon: Settings, href: "/ambulance/settings" },
];

export function Nav() {
    const pathname = usePathname();

    return (
        <aside className="w-20 lg:w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
            <div className="p-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
                    <Truck className="h-5 w-5 text-white" />
                </div>
                <span className="text-white font-black tracking-tight hidden lg:block">DRIVE-SAFE</span>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2">
                {NAV_ITEMS.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 px-3 py-3 rounded-xl transition-all group",
                            pathname === item.href
                                ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
                                : "text-slate-400 hover:bg-white/5 hover:text-white"
                        )}
                    >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="font-bold text-sm hidden lg:block">{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="p-4 mt-auto space-y-2">
                <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-all group"
                >
                    <LogOut className="h-5 w-5 shrink-0" />
                    <span className="font-bold text-sm hidden lg:block">Logout</span>
                </button>
            </div>
        </aside>
    );
}
