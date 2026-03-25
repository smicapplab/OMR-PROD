"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { 
    AlertCircle, CheckCircle2, Loader2, School, Search, HelpCircle, ArrowRight, User, Hash, Globe, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OrphanedScan {
    id: string;
    machineId: string;
    fileName: string;
    createdAt: string;
    extracted_data: any;
    confidence: number;
}

interface SchoolData {
    id: string;
    name: string;
    code: string;
    regionId: string;
}

interface RegionData {
    id: string;
    name: string;
}

export default function CorrectionQueue() {
    const [scans, setScans] = useState<OrphanedScan[]>([]);
    const [schools, setSchools] = useState<SchoolData[]>([]);
    const [regions, setRegions] = useState<RegionData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Assignment State
    const [selectedScan, setSelectedScan] = useState<OrphanedScan | null>(null);
    const [targetSchoolId, setTargetSchoolId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // UI Filtering
    const [searchQuery, setSearchQuery] = useState("");
    const [regionFilter, setRegionFilter] = useState("ALL");

    async function loadData() {
        setIsLoading(true);
        try {
            const [scanRes, schoolRes, regionRes] = await Promise.all([
                apiFetch<OrphanedScan[]>("/api/v1/maintenance/scans/orphaned"),
                apiFetch<any>("/api/v1/maintenance/schools?limit=1000"),
                apiFetch<RegionData[]>("/api/v1/maintenance/regions")
            ]);
            setScans(scanRes);
            setSchools(Array.isArray(schoolRes) ? schoolRes : schoolRes.items || []);
            setRegions(regionRes);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    const handleAssign = async () => {
        if (!selectedScan || !targetSchoolId) return;
        setIsSubmitting(true);
        try {
            await apiFetch("/api/v1/maintenance/scans/assign", {
                method: "POST",
                body: JSON.stringify({ 
                    scanId: selectedScan.id, 
                    schoolId: targetSchoolId 
                })
            });
            setSelectedScan(null);
            setTargetSchoolId("");
            loadData();
        } catch (err) {
            alert("Failed to assign institution");
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredSchools = useMemo(() => {
        return schools.filter(s => {
            const matchesRegion = regionFilter === "ALL" || s.regionId === regionFilter;
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.includes(searchQuery);
            return matchesRegion && matchesSearch;
        }).slice(0, 50);
    }, [schools, searchQuery, regionFilter]);

    return (
        <div className="flex-1 p-10 space-y-10 max-w-7xl mx-auto overflow-y-auto h-screen pb-32">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Orphaned Records</h2>
                    <p className="text-sm text-slate-500 font-medium italic">Review scans with invalid institutional identification and map them to the correct school.</p>
                </div>
                <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-100 font-bold px-4 py-1 rounded-full uppercase text-[10px]">
                    {scans.length} Issues Found
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Issue Stream */}
                <div className="lg:col-span-7">
                    <Card className="rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-slate-100 bg-white">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-slate-100">
                                    <TableHead className="text-[9px] font-bold uppercase text-slate-400 h-12">Extracted Info</TableHead>
                                    <TableHead className="pr-8 text-right text-[9px] font-bold uppercase text-slate-400 h-12">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={3} className="h-80 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                                ) : scans.length > 0 ? scans.map((s) => (
                                    <TableRow key={s.id} className={cn("transition-colors border-slate-50", selectedScan?.id === s.id ? "bg-amber-50/50" : "hover:bg-slate-50/30")}>
                                        <TableCell className="pl-8 py-5">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-3 w-3 text-slate-400" />
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase">
                                                        {s.extracted_data?.student_info?.first_name?.answer || '---'} {s.extracted_data?.student_info?.last_name?.answer || '---'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1.5 opacity-70">
                                                        <HelpCircle className="h-2.5 w-2.5 text-amber-500" />
                                                        <span className="text-[9px] font-semibold text-amber-600 uppercase italic bg-amber-50 px-1.5 rounded">
                                                            BAD ID: {s.extracted_data?.student_info?.school_id?.answer || 'MISSING'}
                                                        </span>
                                                    </div>
                                                    <span className="text-slate-200 text-[8px]">•</span>
                                                    <span className="text-[9px] text-slate-300 font-medium uppercase tracking-tighter">{new Date(s.createdAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="pr-8 text-right">
                                            <Button 
                                                variant="ghost" 
                                                onClick={() => setSelectedScan(s)}
                                                className="h-8 rounded-lg font-bold text-[10px] uppercase text-indigo-600 hover:bg-indigo-50 gap-2"
                                            >
                                                Assign <ArrowRight className="h-3 w-3" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-40 text-center text-slate-400 italic font-medium">Clean slate. All papers are correctly identified.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>

                {/* Assignment Panel */}
                <div className="lg:col-span-5">
                    {selectedScan ? (
                        <Card className="rounded-3xl border-none shadow-xl ring-1 ring-slate-100 bg-white sticky top-10 overflow-hidden">
                            <div className="h-2 bg-indigo-600 w-full" />
                            <CardHeader>
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <School className="h-5 w-5 text-indigo-600" />
                                    Assign Institution
                                </CardTitle>
                                <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                                    Scan ID: {selectedScan.id.substring(0,8)}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <Input 
                                                placeholder="Search by name or code..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="h-10 text-xs pl-8 rounded-xl border-slate-100 bg-slate-50"
                                            />
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300" />
                                        </div>
                                        <div className="relative">
                                            <select 
                                                className="h-10 pl-8 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-medium outline-none appearance-none min-w-[120px]"
                                                value={regionFilter}
                                                onChange={e => setRegionFilter(e.target.value)}
                                            >
                                                <option value="ALL">All Regions</option>
                                                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                            </select>
                                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300" />
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-100">
                                        {filteredSchools.map(s => {
                                            const isSelected = targetSchoolId === s.id;
                                            return (
                                                <button
                                                    key={s.id}
                                                    onClick={() => setTargetSchoolId(s.id)}
                                                    className={cn(
                                                        "w-full px-4 py-3 rounded-xl text-left transition-all relative border flex flex-col",
                                                        isSelected ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" : "bg-white border-slate-100 text-slate-600 hover:border-indigo-200"
                                                    )}
                                                >
                                                    <span className="text-[10px] font-bold uppercase leading-tight mb-1">{s.name}</span>
                                                    <span className={cn("text-[9px] font-medium font-mono uppercase tracking-widest", isSelected ? "text-indigo-200" : "text-slate-400")}>
                                                        CODE: {s.code}
                                                    </span>
                                                    {isSelected && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={() => setSelectedScan(null)} className="flex-1 h-12 rounded-xl font-bold text-xs uppercase text-slate-400">Cancel</Button>
                                    <Button 
                                        onClick={handleAssign} 
                                        disabled={!targetSchoolId || isSubmitting}
                                        className="flex-2 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-indigo-100"
                                    >
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalize Assignment"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-10 bg-slate-50/50 border border-dashed rounded-3xl border-slate-200">
                            <div className="h-16 w-16 bg-white rounded-3xl shadow-sm flex items-center justify-center text-slate-200 mb-4">
                                <ArrowRight className="h-8 w-8" />
                            </div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center max-w-[200px]">Select an orphaned scan from the list to begin assignment.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
