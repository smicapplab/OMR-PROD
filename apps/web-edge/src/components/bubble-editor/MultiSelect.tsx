import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OMRField } from "./types";
import { Badge } from "@/components/ui/badge";

interface MultiSelectProps {
    label: string;
    path: string[];
    fieldData: OMRField;
    onUpdate: (path: string[], nextVal: string[]) => void;
}

export function MultiSelect({ label, path, fieldData, onUpdate }: MultiSelectProps) {
    if (!fieldData || !fieldData.details) return null;
    const columnZero = fieldData.details["0"] || Object.values(fieldData.details)[0];
    const options = Object.keys(columnZero?.scores || {});

    const selected = Array.isArray(fieldData.answer) ? fieldData.answer : [fieldData.answer].filter(v => v && v !== " ");

    const toggle = (opt: string) => {
        let next;
        if (selected.includes(opt)) next = selected.filter(s => s !== opt);
        else next = [...selected, opt];
        onUpdate(path, next);
    };

    return (
        <div className="space-y-3">
            <label className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">{label}</label>

            <div className="flex flex-wrap gap-5 mb-3 min-h-[40px] p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                {selected.length === 0 ? (
                    <span className="text-[10px] text-slate-300 uppercase italic">No selections</span>
                ) : (
                    selected.map(val => (
                        <Badge
                            key={val}
                            variant="secondary"
                            className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none px-2 py-1 gap-1.5 rounded-lg flex items-center animate-in zoom-in-95 duration-200"
                        >
                            <span className="text-[10px] ">{val}</span>
                            <button onClick={() => toggle(val)} className="hover:text-indigo-900">
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))
                )}
                <div className="flex flex-col gap-2 w-full">
                    {options.map(opt => {
                        const isSelected = selected.includes(opt);
                        return (
                            <button
                                key={opt}
                                onClick={() => toggle(opt)}
                                className={cn(
                                    "flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-left transition-all active:scale-95",
                                    isSelected
                                        ? "bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm"
                                        : "bg-white border-slate-100 text-slate-500 hover:border-slate-200 shadow-sm"
                                )}
                            >
                                <span className="text-[10px] uppercase tracking-tight">{opt}</span>
                                {isSelected && <Check className="h-3.5 w-3.5" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
