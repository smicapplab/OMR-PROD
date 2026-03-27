"use client";

import { useEffect, useState, use, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/context/AuthContext";
import {
    FileText, History, Info, ClipboardList, PenLine, ArrowLeft, Loader2,
    ShieldCheck, AlertTriangle, UserCircle, Save, ThumbsUp, ArrowRight,
    ChevronDown,
    ChevronUp,
    ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatOMRYear, normalizeOMRBoolean } from "@/lib/utils";
import Link from "next/link";
import { ZoomableImage } from "@/components/ZoomableImage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BubbleEditor } from "@/components/bubble-editor";
import { CloudScan, AuditLog } from "@omr-prod/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Delta {
    path: string;
    from: string | string[];
    to: string | string[];
    type: 'string' | 'array';
}

function SubjectGradingDetails({ subject, details, extractedAnswers }: { subject: string, details: any, extractedAnswers: any }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden mb-3 last:mb-0 shadow-sm" open={isOpen} onToggle={(e) => setIsOpen(e.currentTarget.open)}>
            <summary className="p-3 bg-slate-50 border-b border-transparent cursor-pointer flex items-center justify-between hover:bg-slate-100 transition-colors list-none font-bold text-[10px] text-slate-700 uppercase tracking-widest outline-none group-open:border-slate-200 group-open:bg-indigo-50/50 [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-3">
                    <span className="text-slate-800 tracking-wider relative top-px">{subject}</span>
                    <Badge className="bg-white text-indigo-700 border-indigo-100 shadow-sm text-[9px] h-5 px-1.5 pointer-events-none">{details.score} / {details.total}</Badge>
                </div>
                <div className="text-[9px] text-indigo-400 font-bold group-open:hidden"><ChevronRight /></div>
                <div className="text-[9px] text-indigo-400 font-bold hidden group-open:block"><ChevronDown /></div>
            </summary>

            <div className="p-0">
                <table className="w-full text-left text-[10px] font-bold">
                    <thead className="bg-white text-slate-400 sticky top-0 uppercase tracking-widest border-b border-slate-100 shadow-sm z-10">
                        <tr>
                            <th className="py-2 px-4 font-black w-12 text-center text-[9px]">Number</th>
                            <th className="py-2 px-2 text-center w-20 text-[9px]">Response</th>
                            <th className="py-2 px-2 text-center w-20 text-[9px]">Answer</th>
                            <th className="py-2 px-4 text-center w-16 text-[9px]">Result</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-600 uppercase">
                        {Object.keys(details.results || {}).sort((a, b) => Number(a) - Number(b)).map(qNum => {
                            const isCorrect = details.results[qNum];
                            const correctAns = details.correctAnswers ? details.correctAnswers[qNum] : '-';
                            const studentAns = extractedAnswers?.[qNum]?.answer || '-';
                            return (
                                <tr key={qNum} className={cn("hover:bg-slate-50/50 transition-colors", !isCorrect && "bg-rose-50/30")}>
                                    <td className="py-2 px-4 text-center text-slate-400 font-black">{qNum}</td>
                                    <td className="py-2 px-2 text-center">
                                        <Badge className={cn("text-[9px] px-1.5 py-0 border-none shadow-none h-4.5 rounded text-center flex items-center justify-center mx-auto max-w-[max-content]", isCorrect ? "bg-emerald-100 text-emerald-700" : (studentAns === '-' ? "bg-slate-100 text-slate-400" : "bg-rose-100 text-rose-700"))}>{studentAns}</Badge>
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <Badge className="bg-slate-100 text-slate-500 border-none shadow-none h-4.5 rounded text-[9px] px-1.5 py-0 text-center flex items-center justify-center mx-auto max-w-[max-content]">{correctAns}</Badge>
                                    </td>
                                    <td className="py-2 px-4 text-center">
                                        {isCorrect ? <ShieldCheck className="h-3 w-3 text-emerald-500 mx-auto" /> : <AlertTriangle className="h-3 w-3 text-rose-400 mx-auto" />}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </details>
    );
}

export default function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();

    const [scan, setScan] = useState<CloudScan | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [correctionHistory, setCorrectionHistory] = useState<AuditLog[]>([]);

    const getDeltas = (details: AuditLog['details']) => {
        const deltas: Delta[] = [];
        const compare = (oldObj: any, newObj: any, currentPath: string = "") => {
            if (!oldObj || !newObj) return;

            if (newObj.hasOwnProperty('answer')) {
                let oldVal = oldObj.answer;
                let newVal = newObj.answer;

                if (currentPath.toLowerCase().includes('year')) {
                    oldVal = formatOMRYear(oldVal);
                    newVal = formatOMRYear(newVal);
                }

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
                        deltas.push({ path: currentPath || "Metadata", from: oldSorted, to: newSorted, type: 'array' });
                    }
                } else if (newVal !== oldVal) {
                    deltas.push({ path: currentPath || "Field", from: String(oldVal ?? '---'), to: String(newVal ?? '---'), type: 'string' });
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
                        <Badge key={i} className={cn("text-[9px] px-1.5 h-auto py-0.5 border-none uppercase whitespace-normal text-left max-w-full font-bold", variant === 'from' ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700")}>
                            {item}
                        </Badge>
                    )) : <span className="text-[10px] text-slate-300">---</span>}
                </div>
            );
        }
        return (
            <div className={cn("min-w-[24px] px-2 py-1 rounded text-[10px] font-black border break-all", variant === 'from' ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")}>
                {val}
            </div>
        );
    };

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [scanData, history] = await Promise.all([
                apiFetch<CloudScan>(`/api/v1/sync/scans/${id}`),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                apiFetch<any[]>(`/api/v1/maintenance/audit-trail?scanId=${id}`)
            ]);
            setScan(scanData);
            setCorrectionHistory(history);
        } catch (err) {
            console.error("Failed to load scan details", err);
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

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
            <Link href="/scans">
                <Button variant="outline">Return to Archives</Button>
            </Link>
        </div>
    );

    const canEditDirectly = user?.userType === 'SUPER_ADMIN' || user?.userType === 'DEPED_MONITOR';

    return (
        <div className="h-screen flex flex-col bg-white overflow-hidden font-sans">
            {/* Header */}
            <header className="h-16 bg-white shrink-0 flex items-center justify-between px-8">
                <div className="flex items-center gap-6">
                    <Link href="/scans">
                        <Button variant="ghost" className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 gap-2 px-3 rounded-xl h-10 transition-all font-bold uppercase text-[10px]">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Records
                        </Button>
                    </Link>
                    <div className="h-8 w-px" />
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-slate-900 font-bold text-sm uppercase tracking-tight leading-none mb-1">
                                {scan.studentName || "Unidentified Record"}
                            </h1>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                                LRN: {scan.lrn || "---"} • Reference ID: {scan.id.split('-')[0]}...
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setIsEditorOpen(true)}
                        className="h-10 px-6 bg-slate-900 hover:bg-black text-white rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-lg shadow-slate-100"
                    >
                        <PenLine className="h-3.5 w-3.5" />
                        {canEditDirectly ? "Modify Data" : "Correction Request"}
                    </Button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Wide Forensic View */}
                <div className="flex-1 flex flex-col relative border-r overflow-hidden group">
                    <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
                        <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none shadow-sm text-[9px] font-bold uppercase h-6 px-3">
                            Official Scan Reference
                        </Badge>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <ZoomableImage src={`${API_URL}${scan.fileUrl}`} alt="Forensic Scan Reference" />
                    </div>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-md px-4 py-2 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Scroll to Zoom • Drag to Pan</p>
                    </div>
                </div>

                {/* Right: Insight Sidebar */}
                <div className="w-96 flex flex-col bg-white">
                    <Tabs defaultValue="overview" className="flex flex-col h-full">
                        <div className="px-6 py-3 border-b">
                            <TabsList className="grid w-full grid-cols-2 h-9 rounded-lg bg-slate-200/50 p-1">
                                <TabsTrigger value="overview" className="rounded-md text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                    Insights
                                </TabsTrigger>
                                <TabsTrigger value="history" className="rounded-md text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                    Audit
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <TabsContent value="overview" className="p-8 m-0 space-y-10 outline-none border-none mb-15">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Info className="h-4 w-4" />
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Official Profile</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100/50 hover:border-slate-200 transition-colors">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Authenticated Name</label>
                                            <p className="text-[15px] font-black text-slate-900 uppercase tracking-tight">{scan.studentName}</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100/50 hover:border-slate-200 transition-colors">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">System LRN</label>
                                            <p className="text-[15px] font-black text-indigo-600 tracking-[0.3em]">{scan.lrn || 'UNIDENTIFIED'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <ClipboardList className="h-4 w-4" />
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Capture Chain</h4>
                                    </div>
                                    <div className="space-y-1">
                                        {[
                                            { label: "Institution", value: scan.schoolName, icon: ShieldCheck },
                                            { label: "Machine Unit", value: scan.machineId, icon: Info },
                                            { label: "Sync Date", value: new Date(scan.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' }), icon: Info }
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-none">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.label}</span>
                                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <div className="p-6 rounded-[2.5rem] bg-indigo-900 text-white shadow-2xl shadow-indigo-100 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-500">
                                            <ShieldCheck className="h-24 w-24" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Verified Score</span>
                                                <Badge className="bg-white/20 text-white border-none text-[8px] font-black uppercase h-5 px-2">
                                                    {((scan.confidence || 0) * 100).toFixed(1)}% Match
                                                </Badge>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-black tracking-tighter">{scan.totalScore}</span>
                                                <span className="text-lg font-black opacity-30">/ {scan.maxScore}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Subject Grading Item Analysis */}
                                    {scan.gradingDetails && Object.keys(scan.gradingDetails).length > 0 && (
                                        <div className="mt-8">
                                            <div className="flex items-center gap-2 text-slate-400 mb-4 px-2">
                                                <ShieldCheck className="h-4 w-4" />
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Item Analysis</h4>
                                            </div>
                                            <div className="flex flex-col">
                                                {Object.keys(scan.gradingDetails).sort().map(subject => (
                                                    <SubjectGradingDetails
                                                        key={subject}
                                                        subject={subject}
                                                        details={scan.gradingDetails[subject]}
                                                        extractedAnswers={scan.extracted_data?.answers?.[subject]}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="history" className="p-0 m-0 outline-none border-none">
                                <div className="p-8 pb-20">
                                    <div className="flex items-center gap-2 text-slate-400 mb-8">
                                        <History className="h-4 w-4" />
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Audit Artifacts</h4>
                                    </div>

                                    {correctionHistory.length > 0 ? (
                                        <div className="relative space-y-6 before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-100">
                                            {correctionHistory.map((h, i) => {
                                                const deltas = getDeltas(h.details);
                                                return (
                                                    <div key={i} className="relative flex items-start gap-3 group text-slate-900">
                                                        <div className={cn(
                                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border-2 shadow-sm z-10",
                                                            h.action === 'BUBBLE_CORRECTION' ? "border-indigo-500 text-indigo-600" : "border-emerald-500 text-emerald-600"
                                                        )}>
                                                            {h.action === 'BUBBLE_CORRECTION' ? <Save className="h-3.5 w-3.5" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                                                        </div>

                                                        <div className="flex flex-1 flex-col gap-0.5 pt-0.5 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black uppercase text-slate-900">{h.action.replace('_', ' ')}</span>
                                                                <span className="text-[8px] font-bold text-slate-400">
                                                                    {new Date(h.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 flex items-center gap-1 font-medium mb-2">
                                                                <UserCircle className="h-3 w-3 text-slate-300" />
                                                                {h.userName && h.userName !== 'SYSTEM' ? h.userName : 'SECURE SYSTEM'}
                                                            </p>

                                                            {h.action === 'BUBBLE_CORRECTION' && deltas.length > 0 && (
                                                                <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100 mb-2">
                                                                    {deltas.map((delta, idx) => (
                                                                        <div key={idx} className="p-2 flex flex-col gap-1.5 hover:bg-white transition-colors">
                                                                            <span className="text-[8px] font-black uppercase text-indigo-600 tracking-tighter">
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

                                                            <div className="mt-2 p-3 rounded-xl bg-slate-50/50 border border-slate-100 border-dashed relative">
                                                                <p className="text-[10px] text-slate-600 font-medium italic leading-relaxed">
                                                                    &quot;{h.reason}&quot;
                                                                </p>
                                                            </div>

                                                            <div className="flex items-center justify-between px-1 mt-2">
                                                                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest text-right w-full">
                                                                    State: {h.status?.replace('_', ' ') || 'OK'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-32 opacity-40">
                                            <div className="h-16 w-16 rounded-3xl bg-slate-50 flex items-center justify-center mb-4 transition-transform hover:rotate-12">
                                                <History className="h-8 w-8 text-slate-300" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">No Historical Records</p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </div>

            {/* Bubble Editor Integration */}
            {scan && (
                <BubbleEditor
                    scan={{ ...scan, rawData: scan.extracted_data }}
                    isOpen={isEditorOpen}
                    onClose={() => setIsEditorOpen(false)}
                    onSaved={() => {
                        loadData();
                        setIsEditorOpen(false);
                    }}
                    mode={canEditDirectly ? "direct" : "pending"}
                />
            )}
        </div>
    );
}
