"use client";

import { useEffect, useState, use, useMemo, useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
    Loader2, ArrowLeft, ShieldCheck, AlertTriangle, Check, X,
    User2, Calendar, MessageCircle, ClipboardCheck,
    ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ZoomableImage } from "@/components/ZoomableImage";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useRouter } from "next/navigation";
import { CloudScan, AuditLog } from "@omr-prod/contracts";

interface ScanDetail extends CloudScan {
    id: string;
    machineId: string;
    fileName: string;
    fileUrl: string;
    extracted_data: any;
    pending_data: any;
    confidence: number;
    status: string;
}

const normalizeLabel = (s: string) => {
    if (!s) return "";
    // If it's a number (item index), keep it
    if (!isNaN(Number(s))) return `Item ${s}`;
    return s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
};

export default function ValidationDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const router = useRouter();
    const [scan, setScan] = useState<ScanDetail | null>(null);

    const canVerify = user?.userType === 'SUPER_ADMIN' || user?.userType === 'DEPED_MONITOR';
    const [log, setLog] = useState<AuditLog | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [scanData, logs] = await Promise.all([
                apiFetch<ScanDetail>(`/api/v1/sync/scans/${id}`),
                apiFetch<AuditLog[]>("/api/v1/maintenance/audit-trail")
            ]);
            setScan(scanData);
            const pendingLog = logs.find(l => l.scanId === id && l.status === 'pending');
            setLog(pendingLog || null);

            if (scanData.pending_data) {
                const allKeys = new Set<string>();
                Object.keys(scanData.pending_data).forEach(subject => {
                    Object.keys(scanData.pending_data[subject]).forEach(qNum => {
                        const pendingAnswer = scanData.pending_data[subject][qNum].answer;
                        const originalAnswer = scanData.extracted_data[subject]?.[qNum]?.answer;

                        const isDifferent = Array.isArray(pendingAnswer)
                            ? JSON.stringify(pendingAnswer) !== JSON.stringify(originalAnswer)
                            : pendingAnswer !== originalAnswer;

                        if (isDifferent) {
                            allKeys.add(`${subject}.${qNum}`);
                        }
                    });
                });
                setSelectedItems(allKeys);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    const toggleItem = (path: string) => {
        const next = new Set(selectedItems);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        setSelectedItems(next);
    };

    const toggleAll = () => {
        if (selectedItems.size === allDiffablePaths.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(allDiffablePaths));
        }
    };

    const handleDecision = async (decision: 'approved' | 'rejected') => {
        if (!scan) return;
        setIsSubmitting(true);
        try {
            await apiFetch("/api/v1/maintenance/scans/approve-correction", {
                method: "POST",
                body: JSON.stringify({
                    scanId: scan.id,
                    logId: log?.id,
                    decision,
                    selectedItems: decision === 'approved' ? Array.from(selectedItems) : []
                })
            });
            router.push("/maintenance/validation");
        } catch (err) {
            console.error(err);
            alert("Failed to process verification decision.");
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [loadData]);

    const allDiffablePaths = useMemo(() => {
        if (!scan || !scan.pending_data) return [];
        const paths: string[] = [];
        Object.keys(scan.pending_data).forEach(subject => {
            Object.keys(scan.pending_data[subject]).forEach(qNum => {
                const pendingAnswer = scan.pending_data[subject][qNum].answer;
                const originalAnswer = scan.extracted_data[subject]?.[qNum]?.answer;

                const isDifferent = Array.isArray(pendingAnswer)
                    ? JSON.stringify(pendingAnswer) !== JSON.stringify(originalAnswer)
                    : pendingAnswer !== originalAnswer;

                if (isDifferent) {
                    paths.push(`${subject}.${qNum}`);
                }
            });
        });
        return paths;
    }, [scan]);

    if (isLoading) return (
        <div className="h-screen w-full flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Loading Official Record...</p>
            </div>
        </div>
    );

    if (!scan) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
            <AlertTriangle className="h-12 w-12 text-amber-400" />
            <p className="text-sm font-bold text-slate-600">Exam record not found.</p>
            <Link href="/maintenance/validation">
                <Button variant="outline">Return to Queue</Button>
            </Link>
        </div>
    );

    const originalAnswers = scan.extracted_data;
    const proposedAnswers = scan.pending_data || originalAnswers;
    const isOrphaned = scan.status === 'orphaned';

    return (
        <div className="h-screen flex flex-col bg-white overflow-hidden font-sans">
            {/* Header */}
            <header className="h-16 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between px-8">
                <div className="flex items-center gap-6">
                    <Link href="/maintenance/validation">
                        <Button variant="ghost" className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 gap-2 px-3 rounded-xl h-10 transition-all font-bold uppercase text-[10px]">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                    <div className="h-8 w-px bg-slate-100" />
                    <div>
                        <h1 className="text-slate-900 font-bold text-sm uppercase tracking-tight leading-none mb-1">
                            {scan.extracted_data.student_info?.first_name?.answer} {scan.extracted_data.student_info?.last_name?.answer}
                        </h1>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                            LRN: {scan.extracted_data.student_info?.lrn?.answer} • Machine: {scan.machineId}
                        </p>
                    </div>
                </div>
            </header>

            {/* Resizable Work Area */}
            <div className="flex-1 min-h-0 bg-slate-50">
                <ResizablePanelGroup orientation="horizontal">
                    {/* Left: Metadata & Diff Viewer */}
                    <ResizablePanel defaultSize={40} minSize={30}>
                        <div className="h-full flex flex-col bg-white border-r">
                            {/* Request Info Box */}
                            <div className="p-6 bg-slate-50/50 border-b border-slate-100 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Correction Request</h2>
                                    <Badge className={cn("border-none text-[8px] font-bold uppercase h-5 px-2", isOrphaned ? "bg-rose-100 text-rose-600" : "bg-indigo-900 text-white")}>
                                        {isOrphaned ? "Orphaned" : "Revision Pending"}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <User2 className="h-3 w-3" />
                                            <span className="text-[8px] font-bold uppercase">Requested By</span>
                                        </div>
                                        <p className="text-[11px] font-medium text-slate-700">{log?.userName || "Internal System"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <Calendar className="h-3 w-3" />
                                            <span className="text-[8px] font-bold uppercase">Date Filed</span>
                                        </div>
                                        <p className="text-[11px] font-medium text-slate-700">{log ? new Date(log.createdAt).toLocaleString() : "---"}</p>
                                    </div>
                                </div>

                                <div className="space-y-1.5 p-3 bg-white border border-slate-100 rounded-xl">
                                    <div className="flex items-center gap-1.5 text-indigo-500">
                                        <MessageCircle className="h-3 w-3" />
                                        <span className="text-[8px] font-bold uppercase text-indigo-600/70">Operator Remarks</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium italic leading-relaxed">
                                        {log?.reason ? `"${log.reason}"` : "No additional comments provided by the operator."}
                                    </p>
                                </div>
                            </div>

                            {/* Granular Selector */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <div className="sticky top-0 z-10 p-6 bg-white flex items-center justify-between border-b border-slate-50 shadow-sm shadow-slate-50/50">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Change Items</h3>
                                        <Badge variant="outline" className="text-[9px] font-bold text-slate-400 border-slate-100">{allDiffablePaths.length}</Badge>
                                    </div>
                                    {allDiffablePaths.length > 0 && canVerify && (
                                        <Button
                                            variant="ghost"
                                            onClick={toggleAll}
                                            className="h-6 px-2 text-[9px] font-bold uppercase text-indigo-600 hover:bg-indigo-50"
                                        >
                                            {selectedItems.size === allDiffablePaths.length ? "Deselect All" : "Select All"}
                                        </Button>
                                    )}
                                </div>

                                <div className="p-6 space-y-8">
                                    {allDiffablePaths.length > 0 ? Object.keys(proposedAnswers).map(subject => {
                                        const subjectDiffs = allDiffablePaths.filter(p => p.startsWith(`${subject}.`));
                                        if (subjectDiffs.length === 0) return null;

                                        return (
                                            <div key={subject} className="space-y-3 overflow-y-auto">
                                                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">{normalizeLabel(subject)}</h4>
                                                <div className="space-y-2">
                                                    {subjectDiffs.map(path => {
                                                        const qNum = path.split('.')[1];
                                                        const isSelected = selectedItems.has(path);
                                                        const oldVal = originalAnswers[subject]?.[qNum]?.answer;
                                                        const newVal = proposedAnswers[subject][qNum].answer;

                                                        const renderValue = (val: any, type: 'old' | 'new') => {
                                                            const isNew = type === 'new';
                                                            const badgeClass = cn(
                                                                "h-5 px-2 font-medium border-none",
                                                                isNew
                                                                    ? (isSelected ? "bg-emerald-200 text-emerald-800" : "bg-emerald-100 text-emerald-700")
                                                                    : "bg-slate-200 text-slate-500"
                                                            );

                                                            if (Array.isArray(val)) {
                                                                return (
                                                                    <div className="flex flex-col gap-1">
                                                                        {val.length > 0 ? val.map((v, i) => (
                                                                            <Badge key={i} variant="secondary" className={badgeClass}>{v}</Badge>
                                                                        )) : <Badge variant="secondary" className={cn(badgeClass, "opacity-50 italic")}>None</Badge>}
                                                                    </div>
                                                                );
                                                            }
                                                            return <Badge variant="secondary" className={badgeClass}>{val || '∅'}</Badge>;
                                                        };

                                                        return (
                                                            <div
                                                                key={path}
                                                                onClick={() => canVerify && toggleItem(path)}
                                                                className={cn(
                                                                    "group flex items-start gap-4 p-4 rounded-2xl border transition-all",
                                                                    canVerify ? "cursor-pointer" : "cursor-default",
                                                                    isSelected ? "bg-indigo-50/20 border-indigo-200" : "bg-white border-slate-100"
                                                                )}
                                                            >
                                                                <div className={cn("shrink-0 mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center transition-colors",
                                                                    isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "bg-slate-50 border-slate-200 text-transparent"
                                                                )}>
                                                                    <Check className={cn("h-3 w-3 stroke-3", !canVerify && !isSelected && "hidden")} />
                                                                </div>

                                                                <div className="flex-1 flex flex-col gap-3">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{normalizeLabel(qNum)}</span>

                                                                    <div className="flex items-start gap-2">
                                                                        <div className="flex items-center gap-2 p-2 px-3 bg-slate-50/50 rounded-xl border border-slate-100/50">
                                                                            {renderValue(oldVal, 'old')}
                                                                        </div>
                                                                        <ArrowRight className="h-4 w-4 text-slate-300 mt-3" />
                                                                        <div className={cn("flex items-center gap-2 p-2 px-3 transition-colors")}>
                                                                            {renderValue(newVal, 'new')}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {canVerify && (
                                                    <div className="flex items-center justify-end gap-3">
                                                        <Button
                                                            variant="ghost"
                                                            onClick={() => handleDecision('rejected')}
                                                            disabled={isSubmitting}
                                                            className="h-10 px-6 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-[10px] uppercase transition-all"
                                                        >
                                                            <X className="h-3.5 w-3.5 mr-2" /> Discard All
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleDecision('approved')}
                                                            disabled={isSubmitting || (allDiffablePaths.length > 0 && selectedItems.size === 0)}
                                                            className="h-10 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10px] uppercase shadow-lg shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50"
                                                        >
                                                            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <ClipboardCheck className="h-3.5 w-3.5 mr-2" />}
                                                            Verify & Commit ({allDiffablePaths.length > 0 ? selectedItems.size : "Global"})
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }) : (
                                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-100 rounded-3xl opacity-60">
                                            <ShieldCheck className="h-10 w-10 text-slate-200 mb-3" />
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest text-center max-w-[180px]">No pending modifications.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </ResizablePanel>

                    <ResizableHandle className="w-1 bg-slate-100 hover:bg-indigo-500 transition-colors" />

                    {/* Right: Forensic Image Reference */}
                    <ResizablePanel defaultSize={60}>
                        <div className="h-full flex flex-col relative group bg-slate-200">
                            <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
                                <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none shadow-sm text-[9px] font-bold uppercase h-6 px-3">
                                    Official Scan Reference
                                </Badge>
                            </div>
                            <div className="flex-1 bg-slate-200 overflow-hidden cursor-crosshair">
                                <ZoomableImage src={`http://localhost:4000${scan.fileUrl}`} alt="Exam Paper Reference" />
                            </div>
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Scroll to Zoom • Drag to Pan</p>
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
}
