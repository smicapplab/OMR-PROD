/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
    Search, Loader2, AlertTriangle,
    ChevronRight, Calendar, Percent,
    Info, FileX, Eye, School, X, Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/app/context/AuthContext";
import { BubbleEditor } from "@/components/bubble-editor";

interface ErroredSheetSummary {
    id: string;
    fileName: string;
    schoolId: string;
    schoolName: string;
    studentName: string;
    confidence: number;
    recognizedRatio: number;
    status: string;
    createdAt: string;
    errorReviewStatus: string;
    errorReviewAction: string | null;
    errorOperatorCorrectionRef: string | null;
    rawData?: any;
    extracted_data?: any;
    reviewerName?: string | null;
    errorReviewedAt?: string | null;
}

interface PaginatedResponse {
    items: ErroredSheetSummary[];
    total: number;
    limit: number;
    offset: number;
}

export default function ErroredSheetsPage() {
    const { user } = useAuth();
    const [sheets, setSheets] = useState<ErroredSheetSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [reviewStatus, setReviewStatus] = useState("pending");
    const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
    const [selectedSheet, setSelectedSheet] = useState<ErroredSheetSummary | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isInvalidating, setIsInvalidating] = useState(false);
    const [invalidReason, setInvalidReason] = useState("");
    const [showInvalidateConfirm, setShowInvalidateConfirm] = useState(false);

    const loadSheets = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiFetch<PaginatedResponse>("/api/v1/sync/errored-sheets", {
                params: {
                    limit: 50,
                    offset: 0,
                    reviewStatus: reviewStatus,
                    search: searchQuery || undefined
                }
            });
            setSheets(data?.items || []);
            setTotal(data?.total || 0);
        } catch (err) {
            console.error("Failed to load errored sheets", err);
        } finally {
            setIsLoading(false);
        }
    }, [reviewStatus, searchQuery]);

    useEffect(() => {
        const timer = setTimeout(loadSheets, 300);
        return () => clearTimeout(timer);
    }, [loadSheets]);

    useEffect(() => {
        if (selectedSheetId) {
            apiFetch<any>(`/api/v1/sync/scans/${selectedSheetId}`).then(setSelectedSheet).catch(console.error);
        } else {
            setSelectedSheet(null);
        }
        setShowInvalidateConfirm(false);
        setInvalidReason("");
    }, [selectedSheetId]);

    const handleMarkInvalid = async () => {
        if (!selectedSheetId) return;
        setIsInvalidating(true);
        try {
            await apiFetch(`/api/v1/sync/errored-sheets/${selectedSheetId}/mark-invalid`, {
                method: "POST",
                body: JSON.stringify({ notes: invalidReason })
            });
            loadSheets();
            setSelectedSheetId(null);
            setInvalidReason("");
            setShowInvalidateConfirm(false);
        } catch (err) {
            console.error(err);
        } finally {
            setIsInvalidating(false);
        }
    };

    const isAuthority = user?.userType === "SUPER_ADMIN";

    return (
        <div className="h-full flex flex-col p-8 bg-slate-50/50">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Errored Sheets</h1>
                    <p className="text-sm text-slate-400 mt-1">Sheets with confidence below 10% threshold awaiting authoritative review.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search student or school..."
                            className="w-64 pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-white rounded-3xl border shadow-sm overflow-hidden">
                <div className="px-8 py-4 border-b flex items-center justify-between">
                    <Tabs value={reviewStatus} onValueChange={setReviewStatus}>
                        <TabsList className="bg-slate-50 p-1 rounded-xl h-9">
                            <TabsTrigger value="pending" className="text-[10px] uppercase font-bold tracking-wider px-4 rounded-lg">
                                Pending {reviewStatus === "pending" && <Badge className="ml-2 h-4 px-1 bg-indigo-600 text-[9px]">{total}</Badge>}
                            </TabsTrigger>
                            <TabsTrigger value="reviewed" className="text-[10px] uppercase font-bold tracking-wider px-4 rounded-lg">
                                Reviewed {reviewStatus === "reviewed" && <Badge className="ml-2 h-4 px-1 bg-slate-400 text-[9px]">{total}</Badge>}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-slate-300" />
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Showing {sheets.length} of {total} records</p>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* List */}
                    <ScrollArea className="flex-1 border-r">
                        <div className="p-4">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-200" />
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Querying Data...</p>
                                </div>
                            ) : sheets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mb-4">
                                        <AlertTriangle className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900">No Errored Sheets Found</h3>
                                    <p className="text-xs text-slate-400 mt-1">Excellent. No scans have dropped below the threshold.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {sheets.map(sheet => (
                                        <Card
                                            key={sheet.id}
                                            className={cn(
                                                "border-none shadow-none cursor-pointer transition-all hover:bg-slate-50",
                                                selectedSheetId === sheet.id ? "bg-indigo-50/50 ring-1 ring-indigo-100" : "bg-white"
                                            )}
                                            onClick={() => setSelectedSheetId(sheet.id)}
                                        >
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                                        <FileX className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{sheet.studentName}</h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <div className="flex items-center gap-1">
                                                                <School className="h-3 w-3 text-slate-300" />
                                                                <span className="text-[10px] text-slate-500 font-medium uppercase truncate max-w-[120px]">{sheet.schoolName}</span>
                                                            </div>
                                                            <span className="text-slate-200 text-[10px]">•</span>
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="h-3 w-3 text-slate-300" />
                                                                <span className="text-[10px] text-slate-400">{new Date(sheet.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6">
                                                    <div className="text-right">
                                                        <div className="flex items-center gap-1.5 justify-end">
                                                            <Percent className="h-3 w-3 text-rose-400" />
                                                            <span className="text-xs font-mono font-bold text-rose-500">{Math.round((sheet.recognizedRatio || 0) * 100)}%</span>
                                                        </div>
                                                        <p className="text-[9px] text-slate-400 uppercase tracking-tighter mt-0.5">Recognition Ratio</p>
                                                    </div>

                                                    {sheet.errorOperatorCorrectionRef && (
                                                        <Badge className="bg-amber-50 text-amber-600 border-none text-[8px] tracking-widest h-5 px-2">CORRECTION SUBMITTED</Badge>
                                                    )}

                                                    <ChevronRight className="h-4 w-4 text-slate-200" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Detail View */}
                    <div className="w-[450px] bg-slate-50/30 flex flex-col p-8">
                        {selectedSheet ? (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                {showInvalidateConfirm ? (
                                    <div className="animate-in fade-in zoom-in duration-200 w-full">
                                        <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4">
                                            <Trash2 className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-base font-bold text-slate-900 mb-2">Discard Errored Sheet?</h3>
                                        <p className="text-xs text-slate-400 mb-6 px-4">This will mark the sheet as permanently invalid. This action will be recorded in the audit trail.</p>
                                        
                                        <div className="text-left space-y-2 mb-6">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Rejection Reason</label>
                                            <textarea 
                                                value={invalidReason}
                                                onChange={(e) => setInvalidReason(e.target.value)}
                                                placeholder="e.g. Scanned image is completely illegible"
                                                className="w-full h-24 rounded-2xl border border-slate-200 bg-white p-4 text-xs outline-none focus:ring-2 focus:ring-rose-500/10 transition-all resize-none shadow-sm"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <Button variant="outline" className="rounded-xl border-slate-200 font-bold" onClick={() => setShowInvalidateConfirm(false)}>
                                                Cancel
                                            </Button>
                                            <Button 
                                                onClick={handleMarkInvalid} 
                                                disabled={isInvalidating} 
                                                className="rounded-xl bg-rose-600 hover:bg-rose-700 font-bold shadow-lg shadow-rose-100"
                                            >
                                                {isInvalidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {selectedSheet.errorReviewStatus === "reviewed" ? (
                                            <div className="flex flex-col items-center justify-center text-center w-full">
                                                <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-4">
                                                    <Info className="h-6 w-6" />
                                                </div>
                                                <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-tight">Resolution Activity Log</h3>
                                                <div className="w-full bg-slate-100 rounded-xl p-4 text-left space-y-2 mt-4">
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resolution</span>
                                                        <p className="text-xs font-medium text-slate-700">
                                                            {selectedSheet.errorReviewAction === 'marked_invalid' ? 'Marked as Invalid' : 'Bubble Correction Applied'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resolved By</span>
                                                        <p className="text-xs font-medium text-slate-700">{selectedSheet.reviewerName || 'System ID or Unknown'}</p>
                                                    </div>
                                                    {selectedSheet.errorReviewedAt && (
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</span>
                                                            <p className="text-xs font-medium text-slate-700">{new Date(selectedSheet.errorReviewedAt).toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <Button 
                                                    onClick={() => setIsEditorOpen(true)}
                                                    className="w-full mt-6 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl h-10 gap-2"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    View Assessed Sheet
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <Info className="h-10 w-10 text-indigo-100 mb-4" />
                                                <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-tight">Authoritative Review Required</h3>
                                                <p className="text-xs text-slate-400 leading-relaxed mb-6 px-10">Confidence is below threshold. Manual intervention is required to either correct the bubbles or mark the sheet as invalid.</p>
                                                
                                                {selectedSheet.errorOperatorCorrectionRef && (
                                                    <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-left w-full">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                                                            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">Operator Correction Pending</p>
                                                        </div>
                                                        <p className="text-[10px] text-amber-700 leading-tight mb-2">An edge operator has submitted a proposed correction for this sheet. You can review it in the Correction Queue.</p>
                                                        <Button variant="link" className="h-auto p-0 text-[10px] text-indigo-600 font-bold uppercase tracking-tighter" onClick={() => window.open(`/maintenance/validation?entryId=${selectedSheet.errorOperatorCorrectionRef}`, '_blank')}>
                                                            View Proposed Changes →
                                                        </Button>
                                                    </div>
                                                )}

                                                <div className="flex flex-col w-full gap-3">
                                                    <Button 
                                                        onClick={() => setIsEditorOpen(true)}
                                                        disabled={!isAuthority}
                                                        className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-8 h-10 shadow-lg shadow-indigo-100 gap-2"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                        Launch Review Interface
                                                    </Button>

                                                    <Button 
                                                        variant="outline" 
                                                        disabled={!isAuthority} 
                                                        className="rounded-xl border-slate-200 h-10 gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                                        onClick={() => setShowInvalidateConfirm(true)}
                                                    >
                                                        <FileX className="h-4 w-4" />
                                                        Mark as Invalid
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 italic text-sm px-10">
                                Select a sheet from the list to begin review
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedSheet && (
                <BubbleEditor
                    scan={selectedSheet as any}
                    isOpen={isEditorOpen}
                    onClose={() => setIsEditorOpen(false)}
                    onSaved={() => {
                        loadSheets();
                        setSelectedSheetId(null);
                    }}
                    customEndpoint={`/api/v1/sync/errored-sheets/${selectedSheet.id}/bubble-correction`}
                />
            )}
        </div>
    );
}
