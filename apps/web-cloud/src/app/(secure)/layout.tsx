"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import {
    LayoutDashboard, Users, School, LogOut,
    BarChart3, ChevronRight,
    FileCheck,
    Globe,
    Monitor,
    AlertTriangle,
    ShieldCheck,
    History
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function SecureLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/");
        }
    }, [user, isLoading, router]);

    if (isLoading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-600 animate-pulse shadow-lg shadow-indigo-100" />
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Synchronizing Vault...</p>
            </div>
        </div>
    );

    if (!user) return null;

    const allNavItems = [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, scopes: ['NATIONAL', 'REGIONAL', 'DIVISION', 'SCHOOL'] },
        { name: "Exam Records", href: "/scans", icon: FileCheck, scopes: ['NATIONAL', 'REGIONAL', 'DIVISION', 'SCHOOL'] },
        { name: "Data Correction Queue", href: "/maintenance/validation", icon: ShieldCheck, scopes: ['NATIONAL', 'SCHOOL'] },
        { name: "Orphaned Records", href: "/maintenance/orphaned", icon: AlertTriangle, scopes: ['NATIONAL'] },
        { name: "Audit History", href: "/maintenance/history", icon: History, scopes: ['NATIONAL'] },
        { name: "Institutions", href: "/maintenance/schools", icon: School, scopes: ['NATIONAL'] },
        { name: "Edge Appliances", href: "/maintenance/machines", icon: Monitor, scopes: ['NATIONAL'] },
        { name: "Region Registry", href: "/maintenance/regions", icon: Globe, scopes: ['NATIONAL'] },
        { name: "User Registry", href: "/maintenance/users", icon: Users, scopes: ['NATIONAL'] },
        { name: "Answer Keys", href: "/maintenance/keys", icon: FileCheck, scopes: ['NATIONAL'] },
        { name: "Analytics", href: "/analytics", icon: BarChart3, disabled: true, scopes: ['NATIONAL', 'REGIONAL'] },
    ];

    const navItems = allNavItems.filter(item => item.scopes.includes(user.visibilityScope));

    return (
        <div className="flex h-screen bg-slate-50/50 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-white flex flex-col shrink-0 z-30">
                <div className="p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-semibold italic shadow-lg shadow-indigo-100">O</div>
                        <span className="font-bold text-slate-900 tracking-tighter text-lg">National Hub</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            href={item.disabled ? "#" : item.href}
                            onClick={item.disabled ? (e) => e.preventDefault() : undefined}
                            className={cn(
                                "flex w-full items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all group",
                                pathname === item.href
                                    ? "bg-indigo-50 text-indigo-700 shadow-sm"
                                    : "text-slate-400 hover:bg-slate-50",
                                item.disabled && "opacity-40 cursor-not-allowed"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className={cn("h-4 w-4", pathname === item.href ? "text-indigo-600" : "text-slate-300 group-hover:text-indigo-400")} />
                                {item.name}
                            </div>
                            {pathname === item.href && <ChevronRight className="h-3 w-3" />}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t">
                    <div className="p-4 bg-slate-900 rounded-2xl text-white shadow-xl">
                        <div className="flex items-center gap-2 mb-1.5 opacity-80">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Security Link Active</p>
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-tighter">Enterprise v1.0.4</p>
                    </div>
                </div>
            </aside>

            {/* Main Section */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20">
                    <div className="flex items-center gap-2 px-1">
                        <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Systems Overview</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-bold text-slate-900 leading-none mb-1">{user.firstName} {user.lastName}</p>
                            <Badge className="bg-indigo-50 text-indigo-600 border-none text-[9px] font-bold uppercase h-4 px-1.5">{user.userType}</Badge>
                        </div>
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-slate-100">
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold text-xs uppercase">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                            </AvatarFallback>
                        </Avatar>
                        <button
                            onClick={logout}
                            className="p-2.5 hover:bg-rose-50 hover:text-rose-500 rounded-xl text-slate-300 transition-all"
                        >
                            <LogOut className="h-5 w-5" />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden">
                    {children}
                </div>
            </main>
        </div>
    );
}
