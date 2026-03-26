"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/app/context/AuthContext";
import {
    Search, Globe, School, ChevronLeft, ChevronRight, Loader2, X
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CloudScan } from "@omr-prod/contracts";

export default function ExamRecords() {
    const { user } = useAuth();
    const router = useRouter();
    const [scans, setScans] = useState<CloudScan[]>([]);
    const [schools, setSchools] = useState<{ id: string, name: string, regionId: string }[]>([]);
    const [regions, setRegions] = useState<{ id: string, name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Pagination & Filter State
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState("");
    const [schoolId, setSchoolId] = useState("");
    const [regionId, setRegionId] = useState("");
    const LIMIT = 20;

    const loadData = useCallback(async (currentOffset = 0) => {
        setIsLoading(true);
        try {
            const data = await apiFetch<{ items: CloudScan[], total: number }>("/api/v1/sync/scans", {
                params: {
                    limit: LIMIT,
                    offset: currentOffset,
                    search, schoolId, regionId
                }
            });
            setScans(data.items);
            setTotal(data.total);
        } catch (err) {
            console.error("Failed to load scans", err);
        } finally {
            setIsLoading(false);
        }
    }, [search, schoolId, regionId]);

    const loadMetadata = async () => {
        try {
            const [schoolRes, regionRes] = await Promise.all([
                apiFetch<{ items: { id: string, name: string, regionId: string }[] }>("/api/v1/maintenance/schools?limit=1000"),
                apiFetch<{ id: string, name: string }[]>("/api/v1/maintenance/regions")
            ]);
            setSchools(Array.isArray(schoolRes) ? schoolRes : schoolRes.items || []);
            setRegions(regionRes);
        } catch (err) {
            console.error("Metadata load failed", err);
        }
    };

    useEffect(() => {
        loadMetadata();
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setOffset(0);
            loadData(0);
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [search, schoolId, regionId, loadData]);

    const handlePageChange = (dir: 'next' | 'prev') => {
        const next = dir === 'next' ? offset + LIMIT : Math.max(0, offset - LIMIT);
        setOffset(next);
        loadData(next);
    };

    const handleViewScan = (scan: CloudScan) => {
        router.push(`/scans/${scan.id}`);
    };

    if (!user) return null;

    return (
        <div className="flex-1 p-10 space-y-8 max-w-7xl mx-auto overflow-y-auto h-screen pb-32">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Exam Records</h2>
                    <p className="text-sm text-slate-500 font-medium italic">Authoritative global capture ledger and grading archives.</p>
                </div>
                <Badge variant="outline" className="bg-slate-900 text-white border-none font-bold px-4 py-1.5 rounded-full uppercase text-[10px]">
                    {total} Total Captures
                </Badge>
            </div>

            {/* Advanced Filters */}
            <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-100 bg-white p-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-5 relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-indigo-500" />
                        <Input
                            placeholder="Search Examinee Name or LRN..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10 h-11 rounded-2xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all"
                        />
                        {search && <X className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300 cursor-pointer" onClick={() => setSearch("")} />}
                    </div>

                    {user.visibilityScope === 'NATIONAL' && (
                        <div className="md:col-span-3">
                            <select
                                className="w-full h-11 px-4 bg-slate-50/50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                value={regionId}
                                onChange={e => { setRegionId(e.target.value); setSchoolId(""); }}
                            >
                                <option value="">All Regions</option>
                                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                    )}

                    {(user.visibilityScope === 'NATIONAL' || user.visibilityScope === 'REGIONAL') && (
                        <div className="md:col-span-4">
                            <select
                                className="w-full h-11 px-4 bg-slate-50/50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                value={schoolId}
                                onChange={e => setSchoolId(e.target.value)}
                            >
                                <option value="">All Institutions</option>
                                {schools.filter(s => !regionId || s.regionId === regionId).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </Card>

            {/* Data Table */}
            <Card className="rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-slate-100 bg-white">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-slate-100">
                            <TableHead className="text-[9px] font-bold uppercase text-slate-400 h-12">Examinee</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase text-slate-400 h-12">Performance</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase text-slate-400 h-12">Chain of Custody</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase text-slate-400 pr-8 text-right h-12">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="h-80 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                        ) : scans.length > 0 ? scans.map((s) => (
                            <TableRow key={s.id} className="hover:bg-slate-50/30 transition-colors border-slate-50 cursor-pointer" onClick={() => handleViewScan(s)}>
                                <TableCell className="pl-8 py-5">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-700 text-[11px] uppercase">{s.studentName}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] text-indigo-500 font-medium uppercase tracking-widest opacity-70 italic">LRN: {s.lrn || '---'}</span>
                                            <span className="text-slate-200 text-[8px]">•</span>
                                            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">{new Date(s.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <div className="flex items-end gap-1 mb-1">
                                            <span className="text-sm font-bold text-slate-900 leading-none">{s.totalScore}</span>
                                            <span className="text-[9px] text-slate-300 font-medium uppercase">/ {s.maxScore}</span>
                                        </div>
                                        <Badge className={cn("text-[8px] font-bold uppercase h-4 px-1.5 border-none", (s.confidence || 0) > 0.8 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                                            {((s.confidence || 0) * 100).toFixed(0)}% Match
                                        </Badge>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5">
                                            <School className="h-3 w-3 text-slate-300" />
                                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight truncate max-w-[150px]">{s.schoolName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Globe className="h-3 w-3 text-slate-300" />
                                            <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">{s.machineId}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="pr-8 text-right">
                                    {s.reviewRequired ? (
                                        <Badge className="bg-amber-50 text-amber-600 border-none text-[9px] font-bold uppercase h-5 px-2">QA Review</Badge>
                                    ) : (
                                        <Badge className="bg-emerald-50 text-emerald-600 border-none text-[9px] font-bold uppercase h-5 px-2">Verified</Badge>
                                    )}
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-60 text-center text-slate-400 italic font-medium uppercase tracking-widest text-[10px]">No exam records match your search criteria.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                {/* Footer Pagination */}
                <div className="p-4 border-t bg-slate-50/30 flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest pl-4">
                        {total === 0 ? "No Records Found" : `Showing ${offset + 1} - ${Math.min(offset + LIMIT, total)} of ${total} Records`}
                    </p>
                    <div className="flex gap-2 pr-4">
                        <Button
                            variant="outline" size="sm" className="h-8 rounded-lg font-bold text-[10px] uppercase gap-1"
                            onClick={() => handlePageChange('prev')} disabled={offset === 0 || isLoading}
                        >
                            <ChevronLeft className="h-3 w-3" /> Previous
                        </Button>
                        <Button
                            variant="outline" size="sm" className="h-8 rounded-lg font-bold text-[10px] uppercase gap-1"
                            onClick={() => handlePageChange('next')} disabled={offset + LIMIT >= total || isLoading}
                        >
                            Next <ChevronRight className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
