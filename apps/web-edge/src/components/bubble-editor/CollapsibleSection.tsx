"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleSectionProps {
    title: string;
    icon?: any;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

export function CollapsibleSection({
    title,
    icon: Icon,
    children,
    defaultOpen = false
}: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="space-y-4 border-b pb-6 last:border-0 last:pb-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full group py-2"
            >
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4 text-indigo-600" />}
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600 transition-colors group-hover:text-indigo-400">
                        {title}
                    </h3>
                </div>
                {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
            </button>
            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    {children}
                </div>
            )}
        </div>
    );
}
