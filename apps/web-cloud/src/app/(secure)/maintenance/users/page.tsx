"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { 
    Users, Plus, Loader2, UserPlus, Mail, Shield, ShieldCheck, School, Eye, Globe, Map, ChevronLeft, ChevronRight, Monitor, Trash2, Edit2, X, Check
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
    visibilityScope: string;
    scopeValue: string;
    schoolId: string | null;
    machineIds: string[];
}

interface MachineData {
    id: string;
    machineId: string;
}

interface RegionData {
    id: string;
    name: string;
    code: string;
}

interface SchoolData {
    id: string;
    name: string;
}

interface PaginatedResponse {
    items: UserData[];
    total: number;
    limit: number;
    offset: number;
}

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
    const [schoolId, setSchoolId] = useState("");
    const [visibilityScope, setVisibilityScope] = useState("SCHOOL");
    const [scopeValue, setScopeValue] = useState("");
    const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);
    const [isActive, setIsActive] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function loadData(currentOffset = 0) {
        setIsLoading(true);
        try {
            const [userRes, schoolRes, regionRes, machineRes] = await Promise.all([
                apiFetch<PaginatedResponse>("/api/v1/maintenance/users", {
                    params: { limit: LIMIT, offset: currentOffset }
                }),
                apiFetch<any>("/api/v1/maintenance/schools?limit=1000"),
                apiFetch<RegionData[]>("/api/v1/maintenance/regions"),
                apiFetch<MachineData[]>("/api/v1/maintenance/machines")
            ]);
            setUsers(userRes.items);
            setTotal(userRes.total);
            setSchools(Array.isArray(schoolRes) ? schoolRes : schoolRes.items || []);
            setRegions(regionRes);
            setMachines(machineRes);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    const resetForm = () => {
        setEditingUser(null);
        setEmail(""); setFirstName(""); setLastName(""); setPassword("");
        setUserType("EDGE_OPERATOR"); setVisibilityScope("SCHOOL");
        setScopeValue(""); setSchoolId(schools[0]?.id || "");
        setSelectedMachineIds([]);
        setIsActive(true);
    };

    const handleEdit = (u: UserData) => {
        setEditingUser(u);
        setEmail(u.email); setFirstName(u.firstName); setLastName(u.lastName);
        setPassword(""); // Keep blank if not changing
        setUserType(u.userType); setVisibilityScope(u.visibilityScope);
        setScopeValue(u.scopeValue); setSchoolId(u.schoolId || schools[0]?.id || "");
        setSelectedMachineIds(u.machineIds || []);
        setIsActive(u.isActive);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this user?")) return;
        try {
            await apiFetch("/api/v1/maintenance/users/delete", {
                method: "POST",
                body: JSON.stringify({ id })
            });
            loadData(offset);
        } catch (err) {
            alert("Failed to delete user");
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const endpoint = editingUser ? "/api/v1/maintenance/users/update" : "/api/v1/maintenance/users";
            const payload = {
                id: editingUser?.id,
                email, firstName, lastName, 
                password: password || undefined,
                userType, 
                schoolId: (userType === 'EDGE_OPERATOR' || userType === 'SCHOOL_ADMIN') ? schoolId : null,
                visibilityScope: (userType === 'SUPER_ADMIN') ? 'NATIONAL' : visibilityScope,
                scopeValue: (userType === 'SUPER_ADMIN') ? 'ALL' : scopeValue,
                machineIds: selectedMachineIds,
                isActive
            };

            await apiFetch(endpoint, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            resetForm();
            loadData(offset);
        } catch (err) {
            alert("Failed to save personnel record");
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleMachine = (id: string) => {
        if (selectedMachineIds.includes(id)) {
            setSelectedMachineIds(selectedMachineIds.filter(m => m !== id));
        } else {
            setSelectedMachineIds([...selectedMachineIds, id]);
        }
    };

    const handlePageChange = (direction: 'next' | 'prev') => {
        const newOffset = direction === 'next' ? offset + LIMIT : Math.max(0, offset - LIMIT);
        setOffset(newOffset);
        loadData(newOffset);
    };

    useEffect(() => {
        loadData(0);
    }, []);

    const currentPage = Math.floor(offset / LIMIT) + 1;
    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="flex-1 p-10 space-y-10 max-w-7xl mx-auto overflow-y-auto h-screen pb-32">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Human Registry</h2>
                    <p className="text-sm text-slate-500 font-medium">Manage personnel access and appliance assignments.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Form Panel */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className={cn("rounded-3xl border-none shadow-sm ring-1 ring-slate-100 sticky top-0 transition-colors", editingUser ? "bg-indigo-50" : "bg-white")}>
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
                            <form onSubmit={handleSave} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Official Email</label>
                                    <Input placeholder="identity@agency.gov.ph" value={email} onChange={e => setEmail(e.target.value)} required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400">First Name</label>
                                        <Input placeholder="Juan" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Last Name</label>
                                        <Input placeholder="Dela Cruz" value={lastName} onChange={e => setLastName(e.target.value)} required />
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">{editingUser ? "Change Password (optional)" : "Password"}</label>
                                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required={!editingUser} />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Account Role</label>
                                    <select 
                                        className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900"
                                        value={userType}
                                        onChange={e => setUserType(e.target.value)}
                                    >
                                        <option value="EDGE_OPERATOR">Edge Operator</option>
                                        <option value="SCHOOL_ADMIN">School Admin</option>
                                        <option value="DEPED_MONITOR">DepEd Monitor (Read-only)</option>
                                        <option value="SUPER_ADMIN">National Admin (Super)</option>
                                    </select>
                                </div>

                                {userType === 'SCHOOL_ADMIN' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Institutional Assignment</label>
                                        <select 
                                            className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900"
                                            value={schoolId}
                                            onChange={e => setSchoolId(e.target.value)}
                                        >
                                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {/* Machine Assignment Grid */}
                                <div className="space-y-2 p-4 bg-slate-100/50 rounded-2xl border border-slate-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                                            <Monitor className="h-3 w-3" />
                                            Authorize Appliances
                                        </label>
                                        <Badge variant="outline" className="text-[8px] font-black bg-white">{selectedMachineIds.length} Selected</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                        {machines.map(m => {
                                            const isSelected = selectedMachineIds.includes(m.id);
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => toggleMachine(m.id)}
                                                    className={cn(
                                                        "px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-between",
                                                        isSelected ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-600"
                                                    )}
                                                >
                                                    <span className="truncate">{m.machineId}</span>
                                                    {isSelected && <Check className="h-2.5 w-2.5" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[8px] text-slate-400 italic">Personnel can only login to authorized units.</p>
                                </div>

                                {editingUser && (
                                    <div className="flex items-center gap-2 py-2">
                                        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} id="isActive" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                        <label htmlFor="isActive" className="text-[10px] font-black uppercase text-slate-600 cursor-pointer">Account is Active</label>
                                    </div>
                                )}

                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-indigo-100 mt-4" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingUser ? "Update Personnel" : "Deploy Credentials")}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* List Panel */}
                <div className="lg:col-span-8 flex flex-col">
                    <Card className="rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-slate-100 bg-white flex flex-col flex-1">
                        <div className="flex-1">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-slate-100">
                                        <TableHead className="pl-8 text-[9px] font-black uppercase text-slate-400 h-12">Personnel</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Role & Appliance</TableHead>
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
                                                    <div className="flex items-center gap-1">
                                                        <Monitor className="h-2.5 w-2.5 text-slate-300" />
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                                                            {u.machineIds?.length || 0} Authorized Units
                                                        </span>
                                                    </div>
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
                                <Button 
                                    variant="outline" size="sm" className="h-8 rounded-lg font-bold text-[10px] uppercase gap-1"
                                    onClick={() => handlePageChange('prev')} disabled={offset === 0 || isLoading}
                                >
                                    <ChevronLeft className="h-3 w-3" /> Prev
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
            </div>
        </div>
    );
}
