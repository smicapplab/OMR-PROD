"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/api";
import { History, UserCircle, Save, ArrowRight, ShieldCheck, Loader2, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatOMRYear, normalizeOMRBoolean } from "@/lib/utils";
import { AuditLog } from "@omr-prod/contracts";

interface Delta {
    path: string;
    from: string | string[];
    to: string | string[];
    type: 'string' | 'array';
}

interface ActivityLogSliderProps {
    scanId: number | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ActivityLogSlider({ scanId, isOpen, onClose }: ActivityLogSliderProps) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && scanId) {
            async function loadLogs() {
                setIsLoading(true);
                try {
                    const data = await apiFetch<AuditLog[]>(`/api/v1/scans/${scanId}/logs`);
                    setLogs(data);
                } catch (err) {
                    console.error("Failed to load logs", err);
                } finally {
                    setIsLoading(false);
                }
            }
            loadLogs();
        }
    }, [isOpen, scanId]);

    const getDeltas = (details: AuditLog["details"]) => {
        const deltas: Delta[] = [];

        const compare = (oldObj: any, newObj: any, currentPath: string = "") => {
            if (!oldObj || !newObj) return;

            if (newObj.hasOwnProperty('answer')) {
                let oldVal = oldObj.answer;
                let newVal = newObj.answer;

                // Format if it's a year field
                if (currentPath.toLowerCase().includes('year')) {
                    oldVal = formatOMRYear(oldVal);
                    newVal = formatOMRYear(newVal);
                }

                // Standardize SSC/4Ps booleans
                const isSSC = currentPath.toLowerCase().includes('ssc') || currentPath.toLowerCase().includes('science') || currentPath.toLowerCase().includes('four_ps');
                if (isSSC) {
                    oldVal = normalizeOMRBoolean(oldVal);
                    newVal = normalizeOMRBoolean(newVal);
                }

                if (Array.isArray(newVal)) {
                    const oldArr = Array.isArray(oldVal) ? oldVal : (oldVal ? [oldVal] : []);
                    const oldSorted = [...oldArr].sort();
                    const newSorted = [...newVal].sort();

                    if (JSON.stringify(oldSorted) !== JSON.stringify(newSorted)) {
                        deltas.push({
                            path: currentPath || "Metadata",
                            from: oldSorted,
                            to: newSorted,
                            type: 'array'
                        });
                    }
                } else if (newVal !== oldVal) {
                    deltas.push({
                        path: currentPath || "Field",
                        from: String(oldVal ?? '---'),
                        to: String(newVal ?? '---'),
                        type: 'string'
                    });
                }
                return;
            }

            Object.keys(newObj).forEach(key => {
                const newPath = currentPath ? `${currentPath} → ${key}` : key;
                if (typeof newObj[key] === 'object' && newObj[key] !== null) {
                    compare(oldObj[key], newObj[key], newPath);
                }
            });
        };

        compare(details?.old_data, details?.new_data);
        return deltas;
    };

    const renderValue = (val: string | string[], variant: 'from' | 'to') => {
        if (Array.isArray(val)) {
            return (
                <div className="flex flex-wrap gap-1 mt-1">
                    {val.length > 0 ? val.map((item, i) => (
                        <Badge
                            key={i}
                            className={cn(
                                "text-[9px] px-1.5 h-auto py-0.5 border-none uppercase whitespace-normal text-left max-w-full ",
                                variant === 'from' ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                            )}
                        >
                            {item}
                        </Badge>
                    )) : <span className="text-[10px] text-slate-300">---</span>}
                </div>
            );
        }
        return (
            <div className={cn(
                "min-w-[24px] px-2 py-1 rounded text-[10px] border break-all",
                variant === 'from' ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
            )}>
                {val}
            </div>
        );
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="sm:max-w-md w-full bg-white border-l p-0 flex flex-col h-full shadow-2xl overflow-hidden outline-none">
                <SheetHeader className="p-4 border-b bg-slate-50 shrink-0 text-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md">
                            <History className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <SheetTitle className="text-base font-bold text-slate-900 leading-none mb-1">Audit Trail</SheetTitle>
                            <SheetDescription className="text-[9px] uppercase tracking-widest text-slate-400">Ref: {scanId}</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-hidden relative">
                    <ScrollArea className="h-full w-full">
                        <div className="p-4 pb-20">
                            {isLoading ? (
                                <div className="py-20 text-center flex flex-col items-center gap-3">
                                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                                    <p className="text-[10px] text-slate-400 uppercase">Syncing audit history...</p>
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="py-10 text-center border-2 border-dashed rounded-2xl border-slate-100">
                                    <ShieldCheck className="h-6 w-6 text-slate-200 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 px-8">No modifications detected.</p>
                                </div>
                            ) : (
                                <div className="relative space-y-6 before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-100">
                                    {logs.map((log) => {
                                        const deltas = getDeltas(log.details);
                                        return (
                                            <div key={log.id} className="relative flex items-start gap-3 group text-slate-900">
                                                <div className={cn(
                                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border-2 shadow-sm z-10",
                                                    log.action === 'SCAN_CORRECTION' ? "border-indigo-500 text-indigo-600" : "border-emerald-500 text-emerald-600"
                                                )}>
                                                    {log.action === 'SCAN_CORRECTION' ? <Save className="h-3.5 w-3.5" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                                                </div>

                                                <div className="flex flex-1 flex-col gap-0.5 pt-0.5 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] uppercase text-slate-900">{log.action.replace('_', ' ')}</span>
                                                        <span className="text-[8px] text-slate-400">
                                                            {log.createdAt ? new Date(log.createdAt.replace(' ', 'T')).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown Time'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mb-2">
                                                        <UserCircle className="h-3 w-3 text-slate-300" />
                                                        {log.operator}
                                                    </p>

                                                    {log.action === 'SCAN_CORRECTION' && deltas.length > 0 && (
                                                        <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100 mb-2">
                                                            {deltas.map((delta, idx) => (
                                                                <div key={idx} className="p-2 flex flex-col gap-1.5 hover:bg-white transition-colors">
                                                                    <span className="text-[8px] uppercase text-indigo-600 tracking-tighter">
                                                                        {delta.path.replace('student_info → ', '').replace('answers → ', '').replace('previous_school → ', 'PREV: ').replace('current_school → ', 'CURR: ')}
                                                                    </span>
                                                                    <div className="flex items-start gap-2">
                                                                        <div className="flex-1 min-w-0">{renderValue(delta.from, 'from')}</div>
                                                                        <ArrowRight className="h-3 w-3 text-slate-300 shrink-0 mt-1.5" />
                                                                        <div className="flex-1 min-w-0">{renderValue(delta.to, 'to')}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {log.details?.reason && (
                                                        <div className="mb-2 p-3 rounded-xl bg-slate-50/50 border border-slate-100 border-dashed relative">
                                                            <p className="text-[10px] text-slate-600 font-medium italic leading-relaxed">
                                                                &quot;{log.details.reason}&quot;
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between px-1">
                                                        <span className="text-[8px] text-slate-300 uppercase tracking-widest text-right w-full">
                                                            State: {log.statusAfter?.replace('_', ' ') || 'OK'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </SheetContent>
        </Sheet>
    );
}
