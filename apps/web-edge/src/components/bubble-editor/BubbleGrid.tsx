"use client";

import { cn } from "@/lib/utils";
import { OMRField, OMRDetailColumn } from "./types";

interface BubbleGridProps {
    label: string;
    path: string[];
    fieldData: OMRField;
    onUpdate: (path: string[], choice: string | null, colIdx: string) => void;
}

export function BubbleGrid({ label, path, fieldData, onUpdate }: BubbleGridProps) {
    if (!fieldData) return null;
    const rawCols = fieldData.details?.digits ? fieldData.details.digits : fieldData.details;
    if (!rawCols) return null;

    const colKeys = Object.keys(rawCols)
        .filter(key => !isNaN(Number(key)))
        .sort((a, b) => Number(a) - Number(b));

    if (colKeys.length === 0) return null;

    return (
        <div className="space-y-3">
            <label className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">{label}</label>
            <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                {colKeys.map(colIdx => {
                    const d = (rawCols as Record<string, OMRDetailColumn>)[colIdx];
                    return (
                        <div key={colIdx} className="flex flex-col items-center gap-1.5">
                            <span className="text-[8px] text-slate-300 uppercase">Col {Number(colIdx) + 1}</span>
                            <div className="flex flex-col gap-1">
                                {Object.keys(d.scores || {}).sort().map(choice => (
                                    <button
                                        key={choice}
                                        onClick={() => onUpdate(path, choice, colIdx)}
                                        className={cn(
                                            "h-6 w-6 rounded-md border flex items-center justify-center text-[9px] transition-all",
                                            d.selected === choice ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:border-indigo-300"
                                        )}
                                    >
                                        {choice}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
