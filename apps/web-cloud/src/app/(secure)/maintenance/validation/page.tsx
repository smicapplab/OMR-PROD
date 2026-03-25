"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { 
    AlertCircle, CheckCircle2, Loader2, ArrowRight, User, Clock, ShieldAlert
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ScanPendingReview {
    id: string;
    machineId: string;
    fileName: string;
    createdAt: string;
    extracted_data: any;
    confidence: number;
}

export default function ValidationQueue() {
    const [scans, setScans] = useState<ScanPendingReview[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    async function loadData() {
        setIsLoading(true);
        try {
            const data = await apiFetch<ScanPendingReview[]>("/api/v1/maintenance/scans/pending-review");
            setScans(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    return (
        <div className="flex-1 p-10 space-y-10 max-w-7xl mx-auto overflow-y-auto h-screen pb-32">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Data Correction Queue</h2>
                    <p className="text-sm text-slate-500 font-medium italic">Verify human-initiated bubble corrections and resolve capture ambiguities from the field.</p>
                </div>
                <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 font-black px-4 py-1 rounded-full uppercase text-[10px]">
                    {scans.length} Pending Actions
                </Badge>
            </div>

            <Card className="rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-slate-100 bg-white">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-slate-100">
                            <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Student Context</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Capture Quality</TableHead>
                            <TableHead className="pr-8 text-right text-[9px] font-black uppercase text-slate-400 h-12">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="h-80 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                        ) : scans.length > 0 ? scans.map((s) => (
                            <TableRow key={s.id} className="hover:bg-slate-50/30 transition-colors border-slate-50">
                                <TableCell className="pl-8 py-5">
                                    <div className="flex flex-col">
                                        <span className="font-black text-slate-700 text-[11px] uppercase">
                                            {s.extracted_data?.student_info?.first_name?.answer || '---'} {s.extracted_data?.student_info?.last_name?.answer || '---'}
                                        </span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest">LRN: {s.extracted_data?.student_info?.lrn?.answer || '---'}</span>
                                            <span className="text-slate-200 text-[8px]">•</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{new Date(s.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge className={cn("text-[9px] font-black uppercase h-5 px-2 border-none", s.confidence < 0.7 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600")}>
                                        {(s.confidence * 100).toFixed(1)}% Match
                                    </Badge>
                                </TableCell>
                                <TableCell className="pr-8 text-right">
                                    <Link href={`/maintenance/validation/${s.id}`}>
                                        <Button 
                                            variant="outline" 
                                            className="h-9 rounded-xl font-black text-[10px] uppercase border-slate-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 gap-2 px-4"
                                        >
                                            Verify Data <ArrowRight className="h-3 w-3" />
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-60 text-center text-slate-400 italic font-medium uppercase tracking-widest text-[10px]">
                                    No pending corrections detected. All human-initiated changes have been resolved or synchronized.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
