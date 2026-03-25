"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectProps {
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    options: string[];
    className?: string;
}

export function Select({ value, onValueChange, placeholder, options, className }: SelectProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-12 w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 active:scale-[0.98]"
            >
                <span className={cn(!value && "text-slate-400 font-medium")}>
                    {value || placeholder || "Select..."}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-[240px] overflow-y-auto scroll-smooth">
                        {options.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => {
                                    onValueChange?.(option);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-bold transition-colors",
                                    value === option
                                        ? "bg-indigo-50 text-indigo-600"
                                        : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <span>{option}</span>
                                {value === option && <Check className="h-4 w-4" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
