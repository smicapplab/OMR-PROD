"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { 
    History, User, FileText, Clock, Search, Filter, ShieldCheck, ChevronLeft, ChevronRight, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CorrectionLog {
    id: string;
    action: string;
    createdAt: string;
    reason: string;
    userName: string;
    userEmail: string;
    fileName: string;
    scanId: string;
}

export default function AuditHistory() {
    const [logs, setLogs] = useState<CorrectionLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    async function loadData() {
        setIsLoading(true);
        try {
            const data = await apiFetch<CorrectionLog[]>("/api/v1/maintenance/audit-trail");
            setLogs(data);
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
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Audit History</h2>
                    <p className="text-sm text-slate-500 font-medium">Historical ledger of all manual data corrections and institutional assignments.</p>
                </div>
            </div>

            <Card className="rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-slate-100 bg-white">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-slate-100">
                            <TableHead className="pl-8 text-[9px] font-black uppercase text-slate-400 h-12">Timestamp</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Personnel</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Action Type</TableHead>
                            <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Affected Record</TableHead>
                            <TableHead className="pr-8 text-[9px] font-black uppercase text-slate-400 h-12">Justification</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="h-80 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                        ) : logs.length > 0 ? logs.map((log) => (
                            <TableRow key={log.id} className="hover:bg-slate-50/30 transition-colors border-slate-50">
                                <TableCell className="pl-8 py-5">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-900">{new Date(log.createdAt).toLocaleDateString()}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-700 uppercase leading-none mb-1">{log.userName}</span>
                                        <span className="text-[9px] font-bold text-slate-400 lowercase">{log.userEmail}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge className={cn(
                                        "text-[8px] font-black uppercase h-4 px-1.5 border-none shadow-sm",
                                        log.action === 'BUBBLE_CORRECTION' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                                    )}>
                                        {log.action.replace('_', ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-3 w-3 text-slate-300" />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{log.fileName.split('.').shift()}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="pr-8 italic text-[10px] text-slate-400 font-medium">
                                    {log.reason || 'No justification provided'}
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-40 text-center text-slate-400 italic font-medium uppercase tracking-widest text-[10px]">No historical corrections found.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
