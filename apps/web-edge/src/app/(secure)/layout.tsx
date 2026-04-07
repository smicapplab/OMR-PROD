"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

export default function SecureLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/");
        }
    }, [user, isLoading, router]);

    if (isLoading) return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Verifying Appliance Access...</p>
        </div>
    );

    if (!user) return null;

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
}
