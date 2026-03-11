/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { 
    Search, Loader2, LogOut, CheckCircle2, 
    Database, ShieldCheck, FileText, 
    RefreshCcw, ChevronRight, History, XCircle, 
    ThumbsUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ZoomableImage } from "@/components/ZoomableImage";
import { BubbleEditor } from "@/components/BubbleEditor";
import { ActivityLogSlider } from "@/components/ActivityLogSlider";
import { Button } from "@/components/ui/button";
import { Scan } from "@omr-prod/contracts";

interface PaginatedResponse {
    items: Scan[];
    total: number;
    skip: number;
    limit: number;
}

export default function DashboardPage() {
    const { user, logout } = useAuth();
    
    const [scans, setScans] = useState<Scan[]>([]);
    const [totalScans, setTotalScans] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    
    const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
    const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
    const [isDetailLoading, setIsDetailScanLoading] = useState(false);
    
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const skipRef = useRef(0);
    const LIMIT = 30;
    
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    const observerTarget = useRef(null);

    const loadScans = useCallback(async (isInitial = true) => {
        if (isInitial) setIsLoading(true);
        else setIsFetchingMore(true);

        try {
            if (isInitial) skipRef.current = 0;
            const currentSkip = skipRef.current;

            const data = await apiFetch<PaginatedResponse>("/api/v1/scans", {
                params: {
                    skip: currentSkip,
                    limit: LIMIT,
                    search: searchQuery || undefined
                }
            });

            const items = data?.items || [];
            if (isInitial) {
                setScans(items);
                if (items.length > 0) {
                    setSelectedScanId(prev => prev === null ? items[0].id : prev);
                }
            } else {
                setScans(prev => [...prev, ...items]);
            }
            
            setTotalScans(data?.total || 0);
            skipRef.current = currentSkip + items.length;
        } catch (err) {
            console.error("Failed to load scans", err);
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [searchQuery]);

    const refreshDetail = async () => {
        if (!selectedScanId) return;
        try {
            const data = await apiFetch<Scan>(`/api/v1/scans/${selectedScanId}`);
            setSelectedScan(data);
        } catch (err) { console.error(err); }
    };

    const handleApprove = async () => {
        if (!selectedScanId) return;
        try {
            await apiFetch(`/api/v1/scans/${selectedScanId}/approve`, { method: "POST" });
            loadScans(true);
            refreshDetail();
        } catch { alert("Only supervisors can approve"); }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            loadScans(true);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, loadScans]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && !isFetchingMore && scans.length < totalScans) {
                    loadScans(false);
                }
            },
            { threshold: 0.1 }
        );
        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => observer.disconnect();
    }, [isFetchingMore, scans.length, totalScans, loadScans]);

    useEffect(() => {
        if (selectedScanId !== null) {
            async function loadDetail() {
                setIsDetailScanLoading(true);
                try {
                    const data = await apiFetch<Scan>(`/api/v1/scans/${selectedScanId}`);
                    setSelectedScan(data);
                } catch (err) {
                    console.error("Failed to load detail", err);
                } finally {
                    setIsDetailScanLoading(false);
                }
            }
            loadDetail();
        }
    }, [selectedScanId]);

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'success': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'synced': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
            case 'pending_approval': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
            default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
        }
    };

    return (
        <div className="flex h-screen bg-slate-50/50 overflow-hidden font-sans text-slate-900">
            <div className="flex flex-1 flex-col overflow-hidden">
                
                <header className="flex h-16 items-center justify-between border-b bg-white px-8 z-20">
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200">
                            <Database className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-900 leading-tight">OMR Edge Console</h1>
                            <div className="flex items-center gap-2">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Appliance Online • DEV-001</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-900">{user?.firstName} {user?.lastName}</p>
                            <Badge className="text-[9px] font-bold text-indigo-600 uppercase tracking-tighter bg-indigo-50 border-none px-1.5 py-0.5 rounded">{user?.userType}</Badge>
                        </div>
                        <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-xs uppercase">
                                {user?.firstName?.[0]}{user?.lastName?.[0]}
                            </AvatarFallback>
                        </Avatar>
                        <button onClick={logout} className="ml-2 p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-500 transition-all">
                            <LogOut className="h-5 w-5" />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-hidden">
                    <ResizablePanelGroup orientation="horizontal">
                        <ResizablePanel defaultSize={30} minSize={20} className="bg-white">
                            <div className="flex h-full flex-col">
                                <div className="p-6 pb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <History className="h-4 w-4 text-slate-400" />
                                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Scan Feed</h2>
                                    </div>
                                    <Badge variant="outline" className="font-mono text-[10px]">{totalScans}</Badge>
                                </div>
                                
                                <div className="px-6 mb-4">
                                    <div className="relative group">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                        <input 
                                            type="text" 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search name or LRN..." 
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent border focus:border-indigo-100 focus:bg-white rounded-xl text-sm outline-none transition-all"
                                        />
                                        {searchQuery && (
                                            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <XCircle className="h-4 w-4 text-slate-300 hover:text-slate-500 transition-colors" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <ScrollArea className="flex-1">
                                    <div className="px-3 pb-6">
                                        {isLoading ? (
                                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                                <RefreshCcw className="h-6 w-6 animate-spin text-slate-200" />
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Indexing database...</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {scans.map((scan) => {
                                                    const sInfo = (scan.rawData as any)?.student_info || {};
                                                    const studentName = sInfo.first_name?.answer || sInfo.last_name?.answer 
                                                        ? `${sInfo.first_name?.answer || ""} ${sInfo.last_name?.answer || ""}`.trim()
                                                        : "UNIDENTIFIED STUDENT";

                                                    return (
                                                        <div 
                                                            key={scan.id}
                                                            onClick={() => setSelectedScanId(scan.id)}
                                                            className={cn(
                                                                "group relative flex flex-col p-4 rounded-2xl cursor-pointer transition-all border-2",
                                                                selectedScanId === scan.id 
                                                                    ? "bg-white border-indigo-600 shadow-md translate-x-1" 
                                                                    : "bg-transparent border-transparent hover:bg-slate-50"
                                                            )}
                                                        >
                                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                                <div className="flex-1 overflow-hidden">
                                                                    <p className={cn("text-sm font-bold truncate uppercase tracking-tight", selectedScanId === scan.id ? "text-indigo-700" : "text-slate-900")}>
                                                                        {studentName}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <FileText className="h-3 w-3 text-slate-300" />
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[120px]">
                                                                            {scan.fileName}
                                                                        </span>
                                                                        <span className="text-slate-200">•</span>
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                            {new Date(scan.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg transition-colors", selectedScanId === scan.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400")}>
                                                                    <ChevronRight className="h-4 w-4" />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-auto">
                                                                <Badge variant="outline" className={cn("text-[9px] h-5 border-none px-2", getStatusColor(scan.processStatus === 'pending_approval' ? 'pending_approval' : scan.syncStatus))}>
                                                                    {scan.processStatus === 'pending_approval' ? 'WAITING APPROVAL' : scan.syncStatus}
                                                                </Badge>
                                                                {scan.isManuallyEdited && (
                                                                    <Badge className="bg-indigo-50 text-indigo-600 border-none text-[8px] h-4">EDITED</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div ref={observerTarget} className="h-10 flex items-center justify-center">
                                                    {isFetchingMore && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </ResizablePanel>

                        <ResizableHandle className="bg-slate-100 w-1.5" />

                        <ResizablePanel defaultSize={70}>
                            {selectedScanId ? (
                                <div className="h-full flex flex-col bg-white">
                                    {isDetailLoading && !selectedScan ? (
                                        <div className="flex flex-1 flex-col items-center justify-center bg-slate-50/30">
                                            <Loader2 className="h-10 w-10 animate-spin text-indigo-200 mb-4" />
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Loading High-Res Official Master...</p>
                                        </div>
                                    ) : selectedScan ? (
                                        <ResizablePanelGroup orientation="horizontal">
                                            <ResizablePanel defaultSize={60} minSize={30} className="bg-slate-900">
                                                <div className="h-full p-4">
                                                    <ZoomableImage src={`${API_URL}${selectedScan.imageUrl}`} />
                                                </div>
                                            </ResizablePanel>

                                            <ResizableHandle className="w-1.5 bg-slate-100 hover:bg-indigo-500 transition-colors" />

                                            <ResizablePanel defaultSize={40} className="bg-white border-l">
                                                <ScrollArea className="h-full">
                                                    <div className="p-8">
                                                        <div className="flex items-center justify-between mb-8">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">Ai</div>
                                                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Extraction Intelligence</h3>
                                                            </div>
                                                            <button 
                                                                onClick={() => setIsLogOpen(true)}
                                                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-all"
                                                            >
                                                                <History className="h-4 w-4" />
                                                            </button>
                                                        </div>

                                                        {/* Approval Banner */}
                                                        {selectedScan.processStatus === 'pending_approval' && (
                                                            <div className="mb-8 p-4 bg-purple-50 rounded-2xl border border-purple-100 flex flex-col gap-3">
                                                                <div className="flex items-center gap-2 text-purple-700">
                                                                    <ShieldCheck className="h-4 w-4" />
                                                                    <span className="text-[11px] font-black uppercase tracking-wider">Awaiting Supervisor Approval</span>
                                                                </div>
                                                                <p className="text-xs text-purple-600/80 leading-relaxed font-medium">This record has manual corrections. A supervisor must verify the changes before they are synced to the cloud.</p>
                                                                {(user?.userType === 'SUPER_ADMIN' || user?.userType === 'SCHOOL_ADMIN') && (
                                                                    <Button 
                                                                        onClick={handleApprove}
                                                                        className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-9 gap-2 text-xs font-bold"
                                                                    >
                                                                        <ThumbsUp className="h-3.5 w-3.5" />
                                                                        Verify & Approve
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        )}

                                                        <Card className="border-none shadow-none bg-slate-50/50 rounded-2xl mb-8">
                                                            <CardHeader className="pb-2">
                                                                <div className="flex justify-between items-start">
                                                                    <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Student Identity</CardTitle>
                                                                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent className="space-y-4">
                                                                <div>
                                                                    <p className="text-xl font-black text-slate-900 uppercase leading-tight">
                                                                        {(selectedScan.rawData as any)?.student_info?.first_name?.answer || '---'} {(selectedScan.rawData as any)?.student_info?.last_name?.answer || '---'}
                                                                    </p>
                                                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                                                        <div>
                                                                            <label className="text-[9px] font-black text-slate-400 uppercase">LRN</label>
                                                                            <p className="text-xs font-mono font-bold text-indigo-600 tracking-widest">
                                                                                {(selectedScan.rawData as any)?.student_info?.lrn?.answer || '---'}
                                                                            </p>
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[9px] font-black text-slate-400 uppercase">SSC</label>
                                                                            <p className="text-xs font-mono font-bold text-slate-700 uppercase">
                                                                                {(selectedScan.rawData as any)?.student_info?.ssc?.answer || '---'}
                                                                            </p>
                                                                        </div>
                                                                        <div className="col-span-2">
                                                                            <label className="text-[9px] font-black text-slate-400 uppercase">Birthdate</label>
                                                                            <p className="text-xs font-bold text-slate-700">
                                                                                {(selectedScan.rawData as any)?.student_info?.birth_month?.answer || '--'} {(selectedScan.rawData as any)?.student_info?.birth_day?.answer || '--'}, {(selectedScan.rawData as any)?.student_info?.birth_year?.answer || '----'}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>

                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Audit Timeline</h4>
                                                                <button 
                                                                    onClick={() => setIsLogOpen(true)}
                                                                    className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter underline underline-offset-4 hover:text-indigo-800"
                                                                >
                                                                    View Full Audit
                                                                </button>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {selectedScan.isManuallyEdited ? (
                                                                    <div className="flex gap-3 items-start bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                                        <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center border shadow-sm shrink-0">
                                                                            <History className="h-3 w-3 text-indigo-600" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs font-bold text-slate-900">Manual Correction Applied</p>
                                                                            <p className="text-[10px] text-slate-500 font-medium">Record was modified by operator</p>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex gap-3 items-start bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200 opacity-60">
                                                                        <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center border shrink-0">
                                                                            <CheckCircle2 className="h-3 w-3 text-slate-300" />
                                                                        </div>
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase italic mt-1.5 tracking-tighter">No integrity modifications</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Exam Modules</h4>
                                                                <button 
                                                                    onClick={() => setIsEditorOpen(true)}
                                                                    className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter underline underline-offset-4 hover:text-indigo-800 transition-colors"
                                                                >
                                                                    Adjust Bubbles
                                                                </button>
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-1 gap-2">
                                                                {Object.keys((selectedScan.rawData as any)?.answers || {}).map(subject => (
                                                                    <div key={subject} className="flex items-center justify-between bg-white border border-slate-100 p-3.5 rounded-xl shadow-sm">
                                                                        <div className="flex items-center gap-3">
                                                                            <FileText className="h-4 w-4 text-slate-400" />
                                                                            <span className="capitalize text-sm font-bold text-slate-700">{subject}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[9px] font-bold text-emerald-600 uppercase">Verified</span>
                                                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </ScrollArea>
                                            </ResizablePanel>
                                        </ResizablePanelGroup>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center bg-slate-50/30 p-20 text-center text-slate-400 italic text-sm">
                                    Select a record from the feed to begin official review
                                </div>
                            )}
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </main>
            </div>

            {selectedScan && (
                <BubbleEditor 
                    scan={selectedScan} 
                    isOpen={isEditorOpen} 
                    onClose={() => setIsEditorOpen(false)} 
                    onSaved={() => {
                        loadScans(true);
                        refreshDetail();
                    }}
                />
            )}

            <ActivityLogSlider 
                scanId={selectedScanId}
                isOpen={isLogOpen}
                onClose={() => setIsLogOpen(false)}
            />
        </div>
    );
}
