/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
    Search, Loader2, AlertTriangle,
    ChevronRight, Calendar, Percent,
    Info, FileX, Eye, Database
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scan } from "@omr-prod/contracts";
import { BubbleEditor } from "@/components/bubble-editor";

interface PaginatedResponse {
    items: Scan[];
    total: number;
    skip: number;
    limit: number;
}

export default function ErroredSheetsPage() {
    const [sheets, setSheets] = useState<Scan[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [status, setStatus] = useState("pending");
    const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null);
    const [selectedSheet, setSelectedSheet] = useState<Scan | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    const loadSheets = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiFetch<PaginatedResponse>("/api/v1/errored-sheets", {
                params: {
                    limit: 50,
                    skip: 0,
                    status: status,
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
    }, [status, searchQuery]);

    useEffect(() => {
        const timer = setTimeout(loadSheets, 300);
        return () => clearTimeout(timer);
    }, [loadSheets]);

    useEffect(() => {
        if (selectedSheetId !== null) {
            apiFetch<Scan>(`/api/v1/scans/${selectedSheetId}`).then(setSelectedSheet).catch(console.error);
        } else {
            setSelectedSheet(null);
        }
    }, [selectedSheetId]);

    return (
        <div className="h-full flex flex-col bg-slate-50/50">
            {/* Header */}
            <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 items-center justify-center rounded-xl bg-rose-50 border border-rose-100 flex">
                        <AlertTriangle className="h-5 w-5 text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-slate-900 leading-tight">Errored Sheets Queue</h1>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Low Confidence Scans • Action Required</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search student name..."
                            className="w-64 pl-10 pr-4 py-2 bg-white border border-slate-100 focus:border-indigo-100 rounded-xl text-sm outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col p-8">
                <div className="flex-1 flex flex-col bg-white rounded-3xl border shadow-sm overflow-hidden">
                    <div className="px-8 py-4 border-b flex items-center justify-between">
                        <Tabs value={status} onValueChange={setStatus}>
                            <TabsList className="bg-slate-50 p-1 rounded-xl h-9">
                                <TabsTrigger value="pending" className="text-[10px] uppercase font-bold tracking-wider px-4 rounded-lg">
                                    Pending Review {status === "pending" && <Badge className="ml-2 h-4 px-1 bg-rose-600 text-[9px]">{total}</Badge>}
                                </TabsTrigger>
                                <TabsTrigger value="reviewed" className="text-[10px] uppercase font-bold tracking-wider px-4 rounded-lg">
                                    Corrected {status === "reviewed" && <Badge className="ml-2 h-4 px-1 bg-slate-400 text-[9px]">{total}</Badge>}
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-slate-300" />
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Local Appliance Queue</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex">
                        {/* List */}
                        <ScrollArea className="flex-1 border-r">
                            <div className="p-4">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <Loader2 className="h-6 w-6 animate-spin text-slate-200" />
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Accessing Local Vault...</p>
                                    </div>
                                ) : sheets.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mb-4">
                                            <Database className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900">Queue is Clear</h3>
                                        <p className="text-xs text-slate-400 mt-1">All scans are within the acceptable confidence threshold.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {sheets.map(sheet => (
                                            <Card
                                                key={sheet.id}
                                                className={cn(
                                                    "border-none shadow-none cursor-pointer transition-all hover:bg-slate-50",
                                                    selectedSheetId === sheet.id ? "bg-rose-50/50 ring-1 ring-rose-100" : "bg-white"
                                                )}
                                                onClick={() => setSelectedSheetId(sheet.id)}
                                            >
                                                <CardContent className="p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                                                            <FileX className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{sheet.studentName || 'Unidentified Student'}</h4>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <div className="flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3 text-slate-300" />
                                                                    <span className="text-[10px] text-slate-400">{new Date(sheet.createdAt).toLocaleDateString()}</span>
                                                                </div>
                                                                <span className="text-slate-200 text-[10px]">•</span>
                                                                <span className="text-[10px] text-slate-400 uppercase tracking-tighter truncate max-w-[150px]">{sheet.fileName}</span>
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
                                                        {sheet.processStatus === 'errored_corrected' && (
                                                            <Badge className="bg-emerald-50 text-emerald-600 border-none text-[8px] tracking-widest h-5 px-2">LOCAL CORRECTION APPLIED</Badge>
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

                        {/* Detail View Placeholder */}
                        <div className="w-[450px] bg-slate-50/30 flex flex-col p-8">
                            {selectedSheetId ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <AlertTriangle className="h-10 w-10 text-rose-200 mb-4" />
                                    <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-tight">Manual Intervention Required</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed mb-6 px-10 font-medium">Confidence is too low for automated processing. You can attempt a manual correction at the edge, but the sheet will still require authoritative review at the National Hub.</p>
                                    <Button 
                                        onClick={() => setIsEditorOpen(true)}
                                        className="bg-rose-600 hover:bg-rose-700 rounded-xl px-8 h-10 shadow-lg shadow-rose-100 gap-2"
                                    >
                                        <Eye className="h-4 w-4" />
                                        Launch Bubble Editor
                                    </Button>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 italic text-sm px-10">
                                    Select an errored record to begin edge-level intervention
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {selectedSheet && (
                <BubbleEditor
                    scan={selectedSheet}
                    isOpen={isEditorOpen}
                    onClose={() => setIsEditorOpen(false)}
                    onSaved={() => {
                        loadSheets();
                        setSelectedSheetId(null);
                    }}
                    saveEndpoint={`/api/v1/errored-sheets/${selectedSheet.id}/operator-correction`}
                />
            )}
        </div>
    );
}
