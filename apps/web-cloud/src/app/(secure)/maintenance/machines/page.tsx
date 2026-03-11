"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { 
    Monitor, Plus, Loader2, Building2, ShieldCheck, Cpu, Key, Clock, School, Globe, Trash2, X, CheckCircle2, Filter, AlertCircle, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Assignment {
    scope: 'SCHOOL' | 'REGION';
    scopeValue: string;
}

interface MachineData {
    id: string;
    machineId: string;
    status: 'pending' | 'active';
    lastHeartbeat: string | null;
    assignments: Assignment[];
}

interface SchoolData {
    id: string;
    name: string;
    regionId: string;
}

interface RegionData {
    id: string;
    name: string;
}

export default function MachinesManagement() {
    const [machines, setMachines] = useState<MachineData[]>([]);
    const [schools, setSchools] = useState<SchoolData[]>([]);
    const [regions, setRegions] = useState<RegionData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Approval State
    const [selectedMachine, setSelectedMachine] = useState<MachineData | null>(null);
    const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
    
    // UI Filtering for selection
    const [selectionTab, setSelectionTab] = useState<'SCHOOL' | 'REGION'>('SCHOOL');
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRegionFilter, setSelectedRegionFilter] = useState("ALL");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function loadData() {
        setIsLoading(true);
        try {
            const [machineData, schoolRes, regionData] = await Promise.all([
                apiFetch<MachineData[]>("/api/v1/maintenance/machines"),
                apiFetch<any>("/api/v1/maintenance/schools?limit=1000"),
                apiFetch<RegionData[]>("/api/v1/maintenance/regions")
            ]);
            setMachines(machineData);
            setSchools(Array.isArray(schoolRes) ? schoolRes : schoolRes.items || []);
            setRegions(regionData);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    const toggleAssignment = (scope: 'SCHOOL' | 'REGION', value: string) => {
        const exists = activeAssignments.find(a => a.scope === scope && a.scopeValue === value);
        if (exists) {
            setActiveAssignments(activeAssignments.filter(a => !(a.scope === scope && a.scopeValue === value)));
        } else {
            setActiveAssignments([...activeAssignments, { scope, scopeValue: value }]);
        }
    };

    const handleApprove = async () => {
        if (!selectedMachine) return;
        setIsSubmitting(true);
        try {
            await apiFetch("/api/v1/maintenance/machines/approve", {
                method: "POST",
                body: JSON.stringify({ 
                    id: selectedMachine.id, 
                    assignments: activeAssignments 
                })
            });
            setSelectedMachine(null);
            setActiveAssignments([]);
            loadData();
        } catch (err) {
            alert("Failed to approve machine");
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const getScopeName = (scope: string, value: string) => {
        if (scope === 'SCHOOL') return schools.find(s => s.id === value)?.name || 'Unknown School';
        return regions.find(r => r.id === value)?.name || 'Unknown Region';
    };

    const filteredSchools = useMemo(() => {
        return schools.filter(s => {
            const matchesRegion = selectedRegionFilter === "ALL" || s.regionId === selectedRegionFilter;
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesRegion && matchesSearch;
        }).slice(0, 100);
    }, [schools, searchQuery, selectedRegionFilter]);

    const filteredRegions = useMemo(() => {
        return regions.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [regions, searchQuery]);

    const pendingMachines = machines.filter(m => m.status === 'pending');
    const activeMachines = machines.filter(m => m.status === 'active');

    return (
        <div className="flex-1 p-10 space-y-10 max-w-7xl mx-auto overflow-y-auto h-screen pb-32">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Appliance Registry</h2>
                    <p className="text-sm text-slate-500 font-medium">Manage and authorize Edge scanning units.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Pending & Authorization Panel */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Approval Selector */}
                    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-100 bg-white">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                Pending Approval ({pendingMachines.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {pendingMachines.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-4 text-center border border-dashed rounded-2xl">No new registration requests.</p>
                            ) : (
                                <div className="space-y-2">
                                    {pendingMachines.map(m => (
                                        <button 
                                            key={m.id}
                                            onClick={() => { setSelectedMachine(m); setActiveAssignments([]); }}
                                            className={cn(
                                                "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                                                selectedMachine?.id === m.id ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100 hover:border-indigo-100"
                                            )}
                                        >
                                            <div>
                                                <p className="text-sm font-black text-slate-900">{m.machineId}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Awaiting Authorization</p>
                                            </div>
                                            {selectedMachine?.id === m.id && <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Authorization Builder */}
                    {selectedMachine && (
                        <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-100 bg-indigo-600 text-white animate-in slide-in-from-top-4 duration-300">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5" />
                                    Authorize {selectedMachine.machineId}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex gap-2 p-1 bg-white/10 rounded-xl">
                                        <button 
                                            onClick={() => setSelectionTab('SCHOOL')}
                                            className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all", selectionTab === 'SCHOOL' ? "bg-white text-indigo-600" : "text-white/60 hover:text-white")}
                                        >Schools</button>
                                        <button 
                                            onClick={() => setSelectionTab('REGION')}
                                            className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all", selectionTab === 'REGION' ? "bg-white text-indigo-600" : "text-white/60 hover:text-white")}
                                        >Regions</button>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <Input 
                                                placeholder="Search..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="h-9 text-xs pl-8 rounded-xl border-none bg-white/10 text-white placeholder:text-white/40"
                                            />
                                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40" />
                                        </div>
                                        {selectionTab === 'SCHOOL' && (
                                            <select 
                                                className="h-9 px-3 bg-white/10 border-none rounded-xl text-[10px] font-bold outline-none text-white"
                                                value={selectedRegionFilter}
                                                onChange={e => setSelectedRegionFilter(e.target.value)}
                                            >
                                                <option value="ALL">All Regions</option>
                                                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                            </select>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-black/10 rounded-2xl border border-white/10">
                                        {(selectionTab === 'SCHOOL' ? filteredSchools : filteredRegions).map(item => {
                                            const isSelected = activeAssignments.some(a => a.scopeValue === item.id);
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => toggleAssignment(selectionTab, item.id)}
                                                    className={cn(
                                                        "px-3 py-2 rounded-xl text-left transition-all relative overflow-hidden text-[10px] font-bold uppercase",
                                                        isSelected ? "bg-white text-indigo-600" : "bg-white/5 text-white/80 hover:bg-white/10"
                                                    )}
                                                >
                                                    <span className="truncate pr-4 block">{item.name}</span>
                                                    {isSelected && <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold opacity-60 italic">Assignments: {activeAssignments.length}</p>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" onClick={() => setSelectedMachine(null)} className="h-9 text-[10px] font-black uppercase text-white hover:bg-white/10">Cancel</Button>
                                            <Button onClick={handleApprove} className="h-9 px-6 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl font-black text-[10px] uppercase shadow-xl" disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve & Deploy"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Active Appliances List */}
                <div className="lg:col-span-7 space-y-6">
                    <Card className="rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-slate-100 bg-white">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-slate-100">
                                    <TableHead className="pl-8 text-[9px] font-black uppercase text-slate-400 h-12">Authorized Appliance</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Operator Scopes</TableHead>
                                    <TableHead className="pr-8 text-right text-[9px] font-black uppercase text-slate-400 h-12">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={3} className="h-80 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                                ) : activeMachines.length > 0 ? activeMachines.map((m) => (
                                    <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                                        <TableCell className="pl-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 text-sm uppercase">{m.machineId}</span>
                                                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold italic">
                                                    <Clock className="h-2.5 w-2.5" /> 
                                                    {m.lastHeartbeat ? `Last Sync: ${new Date(m.lastHeartbeat).toLocaleString()}` : 'Provisioned - Waiting for sync'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1 max-w-[200px] py-2">
                                                {(m.assignments || []).length === 0 ? (
                                                    <span className="text-[9px] font-bold text-slate-300 uppercase">No Scopes</span>
                                                ) : (
                                                    (m.assignments || []).slice(0, 3).map((a, i) => (
                                                        <Badge key={i} variant="secondary" className="text-[8px] font-black uppercase py-0.5 px-1.5 bg-slate-100 text-slate-500 border-none">
                                                            {getScopeName(a.scope, a.scopeValue).split(' ').pop()}
                                                        </Badge>
                                                    ))
                                                )}
                                                {(m.assignments || []).length > 3 && <span className="text-[8px] font-bold text-slate-300">+{(m.assignments || []).length - 3} more</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="pr-8 text-right">
                                            <Badge className="bg-emerald-50 text-emerald-600 border-none text-[9px] font-black uppercase h-5 px-2">Authorized</Badge>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-40 text-center text-slate-400 italic font-medium">No active appliances in the network.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            </div>
        </div>
    );
}
