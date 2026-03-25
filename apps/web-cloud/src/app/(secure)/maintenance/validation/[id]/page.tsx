"use client";

import { useEffect, useState, use } from "react";
import { apiFetch } from "@/lib/api";
import { 
    CheckCircle2, Loader2, ArrowLeft, ArrowRight, ShieldCheck, FileText, AlertTriangle, Check, X, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ZoomableImage } from "@/components/ZoomableImage";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useRouter } from "next/navigation";

interface ScanDetail {
    id: string;
    machineId: string;
    fileName: string;
    fileUrl: string;
    extracted_data: any;
    pending_data: any;
    confidence: number;
    status: string;
}

export default function ValidationDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [scan, setScan] = useState<ScanDetail | null>(null);
    const [log, setLog] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function loadData() {
        setIsLoading(true);
        try {
            const [scanData, logs] = await Promise.all([
                apiFetch<any>(`/api/v1/sync/scans/${id}`),
                apiFetch<any[]>("/api/v1/maintenance/audit-trail")
            ]);
            setScan(scanData);
            const pendingLog = logs.find(l => l.scanId === id && l.status === 'pending');
            setLog(pendingLog);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    const handleDecision = async (decision: 'approved' | 'rejected') => {
        if (!scan) return;
        setIsSubmitting(true);
        try {
            // Case 1: Pure institutional assignment (Orphaned but no bubble changes)
            if (isOrphaned && !scan.pending_data && decision === 'approved') {
                alert("This record is orphaned. Please use the Correction Queue list to assign a school first, or implement school selection here.");
                setIsSubmitting(false);
                return;
            }

            // Case 2: Bubble Correction (Request -> Approve flow)
            await apiFetch("/api/v1/maintenance/scans/approve-correction", {
                method: "POST",
                body: JSON.stringify({ 
                    scanId: scan.id, 
                    logId: log?.id, // Optional, backend will find it if null
                    decision 
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
    }, [id]);

    if (isLoading) return (
        <div className="h-screen w-full flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Official Record...</p>
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
                        <Button variant="ghost" className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 gap-2 px-3 rounded-xl h-10 transition-all font-black uppercase text-[10px]">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                    <div className="h-8 w-px bg-slate-100" />
                    <div>
                        <h1 className="text-slate-900 font-black text-sm uppercase tracking-tight leading-none mb-1">
                            {scan.extracted_data.student_info?.first_name?.answer} {scan.extracted_data.student_info?.last_name?.answer}
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            LRN: {scan.extracted_data.student_info?.lrn?.answer} • Machine: {scan.machineId}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline"
                        onClick={() => handleDecision('rejected')} 
                        disabled={isSubmitting}
                        className="h-10 px-6 border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50 rounded-xl font-black text-[10px] uppercase transition-all"
                    >
                        <X className="h-3.5 w-3.5 mr-2" /> Discard
                    </Button>
                    <Button 
                        onClick={() => handleDecision('approved')}
                        disabled={isSubmitting}
                        className="h-10 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                    >
                        {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Check className="h-3.5 w-3.5 mr-2" />}
                        Verify & Commit
                    </Button>
                </div>
            </header>

            {/* Resizable Work Area */}
            <div className="flex-1 min-h-0 bg-slate-50">
                <ResizablePanelGroup orientation="horizontal">
                    {/* Left: Diff Viewer */}
                    <ResizablePanel defaultSize={40} minSize={30}>
                        <div className="h-full flex flex-col bg-white border-r">
                            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Record Verification</h2>
                                <Badge className={cn("border-none text-[9px] font-black uppercase", isOrphaned ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600")}>
                                    {isOrphaned ? "Institutional Assignment Needed" : "Pending Human Correction"}
                                </Badge>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                {/* Reason Box */}
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info className="h-3 w-3 text-indigo-500" />
                                        <label className="text-[9px] font-black text-indigo-600 uppercase">Decision Context</label>
                                    </div>
                                    <p className="text-xs text-slate-600 font-medium italic">
                                        {log ? `"${log.reason}"` : isOrphaned ? "Institutional identification failed during sync. Please verify student details and assign to the correct school." : "Ambiguous marks detected by OMR engine."}
                                    </p>
                                </div>

                                {/* Answers Diff */}
                                {Object.keys(proposedAnswers).some(subject => 
                                    Object.keys(proposedAnswers[subject]).some(q => proposedAnswers[subject][q].answer !== originalAnswers[subject][q].answer)
                                ) ? Object.keys(proposedAnswers).map(subject => {
                                    const diffs = Object.keys(proposedAnswers[subject]).filter(q => 
                                        proposedAnswers[subject][q].answer !== originalAnswers[subject][q].answer
                                    );

                                    if (diffs.length === 0) return null;

                                    return (
                                        <div key={subject} className="space-y-4">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-slate-900 font-black text-xs uppercase">{subject}</h3>
                                                <Badge className="bg-indigo-50 text-indigo-600 border-none text-[8px] h-4 font-black">{diffs.length} MODIFICATIONS</Badge>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2">
                                                {diffs.map(qNum => (
                                                    <div key={qNum} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase">Item #{qNum}</span>
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[8px] font-bold text-slate-300 uppercase mb-1">Original</span>
                                                                <span className="h-7 w-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-xs font-black text-slate-400">
                                                                    {originalAnswers[subject][qNum].answer || '∅'}
                                                                </span>
                                                            </div>
                                                            <ArrowRight className="h-3 w-3 text-indigo-300" />
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[8px] font-bold text-indigo-600 uppercase mb-1">Proposed</span>
                                                                <span className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-50">
                                                                    {proposedAnswers[subject][qNum].answer}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-100 rounded-3xl opacity-60">
                                        <ShieldCheck className="h-10 w-10 text-slate-200 mb-3" />
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No bubble changes requested.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ResizablePanel>

                    <ResizableHandle className="w-1 bg-slate-100 hover:bg-indigo-500 transition-colors" />

                    {/* Right: Forensic Image Reference */}
                    <ResizablePanel defaultSize={60}>
                        <div className="h-full flex flex-col relative group bg-slate-200">
                            <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
                                <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none shadow-sm text-[9px] font-black uppercase h-6 px-3">
                                    Official Scan Reference
                                </Badge>
                            </div>
                            <div className="flex-1 bg-slate-200 overflow-hidden cursor-crosshair">
                                <ZoomableImage src={`http://localhost:4000${scan.fileUrl}`} alt="Exam Paper Reference" />
                            </div>
                            {/* Overlay Controls Hint */}
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
