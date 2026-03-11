"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { 
    Search, AlertTriangle, Globe, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CloudScan } from "@omr-prod/contracts";
import { usePathname } from "next/navigation";

export default function NationalDashboard() {
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const [scans, setScans] = useState<CloudScan[]>([]);
    const [stats, setStats] = useState({ totalScans: 0, reviewRequired: 0 });
    const [isLoading, setIsLoading] = useState(true);

    async function loadGlobalStats() {
        try {
            const data = await apiFetch<{ recentScans: CloudScan[], totalScans: number, reviewRequired: number }>("/api/v1/sync/stats");
            setScans(data.recentScans || []);
            setStats({
                totalScans: data.totalScans || 0,
                reviewRequired: data.reviewRequired || 0
            });
        } catch (err) {
            console.error("Failed to load stats", err);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadGlobalStats();
        const interval = setInterval(loadGlobalStats, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <ScrollArea className="h-full w-full">
            <div className="p-10 space-y-10 max-w-7xl mx-auto">
                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-100 bg-white">
                        <CardContent className="p-6">
                            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
                                <Globe className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Exams Synced</p>
                            <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.totalScans}</h3>
                            <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1">Live Feed active</p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-100 bg-white">
                        <CardContent className="p-6">
                            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-4">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Review Pipeline</p>
                            <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.reviewRequired}</h3>
                            <p className="text-xs text-amber-600 font-bold mt-2 font-black uppercase tracking-tighter">Awaiting verification</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Stream */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="space-y-1">
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">Global Sync Stream</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Across all registered appliances</p>
                        </div>
                        <Button variant="outline" className="rounded-xl font-black text-[10px] uppercase border-slate-200">Export Raw Logs</Button>
                    </div>

                    <Card className="rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-slate-100 bg-white">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-slate-100 hover:bg-transparent">
                                    <TableHead className="text-[9px] font-black uppercase text-slate-400 pl-8 h-12">Examinee</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Institution</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase text-slate-400 text-center h-12">Calculated Score</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Integrity</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase text-slate-400 pr-8 text-right h-12">Synced At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-60 text-center">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-200" />
                                        </TableCell>
                                    </TableRow>
                                ) : scans.length > 0 ? scans.map((scan) => (
                                    <TableRow key={scan.id} className="hover:bg-slate-50/50 transition-colors border-slate-50 cursor-pointer group">
                                        <TableCell className="pl-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 text-sm uppercase leading-none mb-1">{scan.studentName || 'Unidentified'}</span>
                                                <span className="text-[10px] font-mono text-indigo-600 tracking-widest opacity-70 italic font-bold">LRN: {scan.lrn || '---'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-bold text-slate-500 text-[10px] uppercase">
                                            {scan.schoolName || 'Unknown School'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <span className="text-sm font-black text-slate-900 leading-none">{scan.totalScore}</span>
                                                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter mt-1">of {scan.maxScore} pts</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge className={cn(
                                                    "text-[9px] font-black uppercase h-5 px-2 border-none shadow-sm",
                                                    scan.confidence > 0.8 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                )}>
                                                    {(scan.confidence * 100).toFixed(0)}% Precise
                                                </Badge>
                                                {scan.reviewRequired && <Badge className="bg-amber-50 text-amber-600 border-none text-[9px] h-5 px-2 uppercase font-black tracking-tighter">Manual</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="pr-8 text-right text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                            {new Date(scan.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-60 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-30">
                                                <Search className="h-8 w-8" />
                                                <p className="text-xs font-black uppercase tracking-widest">Listening for data...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            </div>
        </ScrollArea>
    );
}
