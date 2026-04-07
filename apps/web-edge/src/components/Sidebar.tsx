"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, AlertTriangle, LogOut, LayoutDashboard, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
    const pathname = usePathname();
    const { logout, user } = useAuth();
    const [erroredCount, setErroredCount] = useState(0);

    useEffect(() => {
        const fetchErroredCount = async () => {
            try {
                const data = await apiFetch<any>("/api/v1/errored-sheets", { params: { limit: 1, status: 'pending' } });
                setErroredCount(data?.total || 0);
            } catch (err) { console.error(err); }
        };
        if (user) fetchErroredCount();
    }, [user]);

    const navItems = [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Errored Sheets", href: "/errored-sheets", icon: AlertTriangle, badge: erroredCount > 0 ? erroredCount : undefined },
    ];

    return (
        <aside className="w-64 border-r bg-white flex flex-col shrink-0 z-30">
            <div className="p-6 border-b">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                        <Database className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-slate-900 tracking-tighter text-lg">Edge Console</span>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                            "flex w-full items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all group",
                            pathname === item.href
                                ? "bg-indigo-50 text-indigo-700 shadow-sm"
                                : "text-slate-400 hover:bg-slate-50"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <item.icon className={cn("h-4 w-4", pathname === item.href ? "text-indigo-600" : "text-slate-300 group-hover:text-indigo-400")} />
                            {item.name}
                        </div>
                        <div className="flex items-center gap-2">
                            {item.badge && <Badge className="bg-rose-500 text-white h-5 px-1.5 border-none text-[10px] font-bold shadow-sm">{item.badge}</Badge>}
                            {pathname === item.href && <ChevronRight className="h-3 w-3" />}
                        </div>
                    </Link>
                ))}
            </nav>

            <div className="p-6 border-t">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-900 truncate">{user?.firstName} {user?.lastName}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{user?.userType}</p>
                    </div>
                </div>
                <button 
                    onClick={logout}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm font-semibold text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
