"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { 
    Users, Plus, Loader2, UserPlus, Mail, Shield, ShieldCheck, School, Eye, Globe, Map, ChevronLeft, ChevronRight, Monitor, Trash2, Edit2, X, Check, Filter, Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserData {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userType: string;
    isActive: boolean;
    visibilityScope: 'NATIONAL' | 'REGIONAL' | 'SCHOOL';
    scopeValue: string;
    schoolId: string | null;
    machineIds: string[];
}

interface MachineData { id: string; machineId: string; }
interface RegionData { id: string; name: string; code: string; }
interface SchoolData { id: string; name: string; regionId: string; code: string; }

const ROLE_LABELS: Record<string, string> = {
    'SUPER_ADMIN': 'National Admin',
    'NATIONAL_AUDITOR': 'National Auditor',
    'SCHOOL_ADMIN': 'School Admin',
    'EDGE_OPERATOR': 'Edge Operator',
    'DEPED_MONITOR': 'DepEd Monitor'
};

export default function UsersManagement() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [schools, setSchools] = useState<SchoolData[]>([]);
    const [regions, setRegions] = useState<RegionData[]>([]);
    const [machines, setMachines] = useState<MachineData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const LIMIT = 10;
    
    // Form State
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [password, setPassword] = useState("");
    const [userType, setUserType] = useState("EDGE_OPERATOR");
    
    // Scoping state
    const [visibilityScope, setVisibilityScope] = useState<'NATIONAL' | 'REGIONAL' | 'SCHOOL'>('SCHOOL');
    const [selectedSchoolId, setSelectedSchoolId] = useState(""); // For SCHOOL_ADMIN (Single)
    const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]); // For EDGE_OPERATOR
    const [multiScopeValues, setMultiScopeValues] = useState<string[]>([]); // For DEPED_MONITOR
    
    // Selection Helpers
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRegionFilter, setSelectedRegionFilter] = useState("ALL");
    const [isActive, setIsActive] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function loadData(currentOffset = 0) {
        setIsLoading(true);
        try {
            const [userRes, schoolRes, regionRes, machineRes] = await Promise.all([
                apiFetch<any>("/api/v1/maintenance/users", { params: { limit: LIMIT, offset: currentOffset } }),
                apiFetch<any>("/api/v1/maintenance/schools?limit=1000"),
                apiFetch<RegionData[]>("/api/v1/maintenance/regions"),
                apiFetch<MachineData[]>("/api/v1/maintenance/machines")
            ]);
            setUsers(userRes.items || []);
            setTotal(userRes.total || 0);
            setSchools(Array.isArray(schoolRes) ? schoolRes : schoolRes.items || []);
            setRegions(regionRes || []);
            setMachines(machineRes || []);
        } catch (err) {
            console.error("❌ Failed to load registry data", err);
        } finally {
            setIsLoading(false);
        }
    }

    const resetForm = () => {
        setEditingUser(null);
        setEmail(""); setFirstName(""); setLastName(""); setPassword("");
        setUserType("EDGE_OPERATOR"); setVisibilityScope("SCHOOL");
        setSelectedSchoolId(""); setSelectedMachineIds([]); setMultiScopeValues([]);
        setIsActive(true);
    };

    const handleEdit = (u: UserData) => {
        setEditingUser(u);
        setEmail(u.email); setFirstName(u.firstName); setLastName(u.lastName);
        setPassword(""); 
        setUserType(u.userType); setVisibilityScope(u.visibilityScope);
        setIsActive(u.isActive);
        
        // Restore appropriate scopes
        if (u.userType === 'SCHOOL_ADMIN') setSelectedSchoolId(u.scopeValue);
        if (u.userType === 'EDGE_OPERATOR') setSelectedMachineIds(u.machineIds || []);
        if (u.userType === 'DEPED_MONITOR') setMultiScopeValues(u.scopeValue ? u.scopeValue.split(',') : []);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const endpoint = editingUser ? "/api/v1/maintenance/users/update" : "/api/v1/maintenance/users";
            
            // Resolve scopeValue based on role
            let finalScopeValue = "";
            if (userType === 'SUPER_ADMIN' || userType === 'NATIONAL_AUDITOR') finalScopeValue = "ALL";
            else if (userType === 'SCHOOL_ADMIN') finalScopeValue = selectedSchoolId;
            else if (userType === 'DEPED_MONITOR') finalScopeValue = multiScopeValues.join(',');

            const payload = {
                id: editingUser?.id,
                email, firstName, lastName, password: password || undefined,
                userType, 
                visibilityScope: (userType === 'SUPER_ADMIN' || userType === 'NATIONAL_AUDITOR') ? 'NATIONAL' : visibilityScope,
                scopeValue: finalScopeValue,
                machineIds: userType === 'EDGE_OPERATOR' ? selectedMachineIds : [],
                isActive
            };

            await apiFetch(endpoint, { method: "POST", body: JSON.stringify(payload) });
            resetForm(); loadData(offset);
        } catch (err) {
            alert("Failed to save personnel record");
        } finally { setIsSubmitting(false); }
    };

    const toggleMultiValue = (val: string) => {
        if (multiScopeValues.includes(val)) setMultiScopeValues(multiScopeValues.filter(v => v !== val));
        else setMultiScopeValues([...multiScopeValues, val]);
    };

    const filteredSchools = useMemo(() => {
        return schools.filter(s => {
            const matchesRegion = selectedRegionFilter === "ALL" || s.regionId === selectedRegionFilter;
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.includes(searchQuery);
            return matchesRegion && matchesSearch;
        }).slice(0, 50);
    }, [schools, searchQuery, selectedRegionFilter]);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this user?")) return;
        try {
            await apiFetch("/api/v1/maintenance/users/delete", { method: "POST", body: JSON.stringify({ id }) });
            loadData(offset);
        } catch (err) { alert("Failed to delete user"); }
    };

    const handlePageChange = (direction: 'next' | 'prev') => {
        const newOffset = direction === 'next' ? offset + LIMIT : Math.max(0, offset - LIMIT);
        setOffset(newOffset);
        loadData(newOffset);
    };

    useEffect(() => { loadData(0); }, []);

    const currentPage = Math.floor(offset / LIMIT) + 1;
    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="flex-1 p-10 space-y-10 max-w-7xl mx-auto overflow-y-auto h-screen pb-32">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Human Registry</h2>
                    <p className="text-sm text-slate-500 font-medium italic">Manage personnel access and departmental authority boundaries.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Form Panel */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className={cn("rounded-3xl border-none shadow-sm ring-1 ring-slate-100 sticky top-0 transition-all overflow-hidden", editingUser ? "bg-indigo-50/50" : "bg-white")}>
                        <div className="h-1.5 bg-indigo-600" />
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <UserPlus className="h-5 w-5 text-indigo-600" />
                                    {editingUser ? "Edit Personnel" : "Provision Account"}
                                </div>
                                {editingUser && <button onClick={resetForm}><X className="h-4 w-4 text-slate-400 hover:text-slate-600" /></button>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSave} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Official Credentials</label>
                                    <Input placeholder="email@omr-prod.gov.ph" value={email} onChange={e => setEmail(e.target.value)} required className="h-11 rounded-xl" />
                                    <Input type="password" placeholder={editingUser ? "Leave blank to keep current" : "Secure Password"} value={password} onChange={e => setPassword(e.target.value)} required={!editingUser} className="h-11 rounded-xl" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">First Name</label>
                                        <Input placeholder="Juan" value={firstName} onChange={e => setFirstName(e.target.value)} required className="h-11 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Last Name</label>
                                        <Input placeholder="Dela Cruz" value={lastName} onChange={e => setLastName(e.target.value)} required className="h-11 rounded-xl" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Assigned Role</label>
                                    <select 
                                        className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                                        value={userType}
                                        onChange={e => {
                                            const role = e.target.value;
                                            setUserType(role);
                                            // Auto-adjust scope based on role
                                            if (role === 'EDGE_OPERATOR' || role === 'SCHOOL_ADMIN') setVisibilityScope('SCHOOL');
                                            else if (role === 'DEPED_MONITOR') setVisibilityScope('REGIONAL');
                                            else setVisibilityScope('NATIONAL');
                                        }}
                                    >
                                        {Object.entries(ROLE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                    </select>
                                </div>

                                {/* --- DYNAMIC AUTHORITY PANELS --- */}

                                {/* 1. EDGE OPERATOR: Appliance Selection */}
                                {userType === 'EDGE_OPERATOR' && (
                                    <div className="space-y-3 p-4 bg-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5"><Monitor className="h-3 w-3" /> Authorize Appliances</label>
                                            <Badge variant="outline" className="text-[8px] font-black bg-white">{selectedMachineIds.length} Linked</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                            {machines.map(m => (
                                                <button key={m.id} type="button" onClick={() => setSelectedMachineIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                                                    className={cn("px-2 py-2 rounded-xl border text-[10px] font-bold transition-all truncate", selectedMachineIds.includes(m.id) ? "bg-indigo-600 border-indigo-600 text-white shadow-md" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200")}>
                                                    {m.machineId}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 2. SCHOOL ADMIN & DEPED MONITOR: Selection Interface */}
                                {(userType === 'SCHOOL_ADMIN' || userType === 'DEPED_MONITOR') && (
                                    <div className="space-y-4 p-4 bg-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                                                {userType === 'SCHOOL_ADMIN' ? <School className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                                                Authority Scoping
                                            </label>
                                            {userType === 'DEPED_MONITOR' && (
                                                <div className="flex gap-2 p-1 bg-white rounded-xl border border-slate-200">
                                                    <button type="button" onClick={() => { setVisibilityScope('REGIONAL'); setMultiScopeValues([]); }} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all", visibilityScope === 'REGIONAL' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400")}>By Region</button>
                                                    <button type="button" onClick={() => { setVisibilityScope('SCHOOL'); setMultiScopeValues([]); }} className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all", visibilityScope === 'SCHOOL' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400")}>By School</button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <div className="flex-1 relative">
                                                    <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-9 text-xs pl-8 rounded-xl border-slate-200 bg-white shadow-none" />
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                                </div>
                                                {(visibilityScope === 'SCHOOL' || userType === 'SCHOOL_ADMIN') && (
                                                    <div className="relative">
                                                        <select className="h-9 pl-7 pr-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold min-w-[100px] outline-none focus:ring-2 focus:ring-indigo-500 appearance-none" value={selectedRegionFilter} onChange={e => setSelectedRegionFilter(e.target.value)}>
                                                            <option value="ALL">All Regions</option>
                                                            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                        </select>
                                                        <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-300" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                                                {(visibilityScope === 'REGIONAL' ? regions : filteredSchools).map(item => {
                                                    const isSelected = userType === 'SCHOOL_ADMIN' 
                                                        ? selectedSchoolId === item.id 
                                                        : multiScopeValues.includes(item.id);
                                                    
                                                    return (
                                                        <button key={item.id} type="button" 
                                                            onClick={() => {
                                                                if (userType === 'SCHOOL_ADMIN') setSelectedSchoolId(item.id);
                                                                else toggleMultiValue(item.id);
                                                            }}
                                                            className={cn("w-full px-3 py-2 rounded-lg border text-left transition-all relative overflow-hidden", isSelected ? "bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm" : "bg-white border-slate-100 text-slate-600 hover:border-slate-200")}>
                                                            <span className="text-[10px] font-bold uppercase truncate block pr-6">{item.name}</span>
                                                            {isSelected && <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-indigo-600" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {userType === 'DEPED_MONITOR' && <p className="text-[8px] text-slate-400 font-bold italic text-center uppercase tracking-tighter">Total selections: {multiScopeValues.length}</p>}
                                        </div>
                                    </div>
                                )}

                                {/* --- ACTION BUTTONS --- */}
                                <div className="flex items-center gap-2 py-2">
                                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} id="isActive" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    <label htmlFor="isActive" className="text-[10px] font-black uppercase text-slate-600 cursor-pointer tracking-widest">Account is Active</label>
                                </div>

                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-indigo-100 mt-2" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingUser ? "Update Registry" : "Deploy Credentials")}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* List Panel */}
                <div className="lg:col-span-7 flex flex-col">
                    <Card className="rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-slate-100 bg-white flex flex-col flex-1">
                        <div className="flex-1">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-slate-100">
                                        <TableHead className="pl-8 text-[9px] font-black uppercase text-slate-400 h-12">Personnel</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Authority & Scope</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Status</TableHead>
                                        <TableHead className="pr-8 text-right text-[9px] font-black uppercase text-slate-400 h-12">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={4} className="h-80 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                                    ) : users.map((u) => (
                                        <TableRow key={u.id} className="hover:bg-slate-50/50 transition-colors border-slate-50 group">
                                            <TableCell className="pl-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                        <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-black uppercase">
                                                            {u.firstName?.[0]}{u.lastName?.[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-slate-900 text-sm leading-none mb-1">{u.firstName} {u.lastName}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{u.email}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="outline" className={cn(
                                                        "text-[9px] font-black uppercase h-5 px-2 border-none shadow-sm w-fit",
                                                        u.userType === 'SUPER_ADMIN' ? "bg-slate-900 text-white" : "bg-indigo-50 text-indigo-600"
                                                    )}>
                                                        {ROLE_LABELS[u.userType] || u.userType}
                                                    </Badge>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                        {u.visibilityScope === 'NATIONAL' ? <Globe className="h-2.5 w-2.5" /> : u.visibilityScope === 'REGIONAL' ? <Map className="h-2.5 w-2.5" /> : <School className="h-2.5 w-2.5" />}
                                                        {u.visibilityScope} Authority
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={cn("h-1.5 w-1.5 rounded-full", u.isActive ? "bg-emerald-500" : "bg-rose-500")}></div>
                                                    <span className="text-[9px] font-black text-slate-500 uppercase">{u.isActive ? "Active" : "Disabled"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="pr-8 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEdit(u)} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"><Edit2 className="h-4 w-4" /></button>
                                                    <button onClick={() => handleDelete(u.id)} className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="p-4 border-t bg-slate-50/30 flex items-center justify-between">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">
                                Page {currentPage} of {totalPages || 1} <span className="mx-2 opacity-30">•</span> {total} Personnel
                            </p>
                            <div className="flex gap-2 pr-4">
                                <Button variant="outline" size="sm" className="h-8 rounded-lg font-bold text-[10px] uppercase gap-1" onClick={() => handlePageChange('prev')} disabled={offset === 0 || isLoading}>
                                    <ChevronLeft className="h-3 w-3" /> Prev
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 rounded-lg font-bold text-[10px] uppercase gap-1" onClick={() => handlePageChange('next')} disabled={offset + LIMIT >= total || isLoading}>
                                    Next <ChevronRight className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
