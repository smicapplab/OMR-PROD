"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { 
    Users, Plus, Loader2, UserPlus, Mail, Shield, ShieldCheck, School, Eye, Globe, Map, ChevronLeft, ChevronRight
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
}

interface SchoolData {
    id: string;
    name: string;
    region: string;
    division: string;
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
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const LIMIT = 10;
    
    // Form State
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [password, setPassword] = useState("password123");
    const [userType, setUserType] = useState("EDGE_OPERATOR");
    const [schoolId, setSchoolId] = useState("");
    const [visibilityScope, setVisibilityScope] = useState("SCHOOL");
    const [scopeValue, setScopeValue] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function loadData(currentOffset = 0) {
        setIsLoading(true);
        try {
            const [userRes, schoolData] = await Promise.all([
                apiFetch<PaginatedResponse>("/api/v1/maintenance/users", {
                    params: { limit: LIMIT, offset: currentOffset }
                }),
                apiFetch<SchoolData[]>("/api/v1/maintenance/schools")
            ]);
            setUsers(userRes.items);
            setTotal(userRes.total);
            // Handle school list pagination if needed later, for now schoolRes might be full list or paginated
            // If schools endpoint also returns paginated, we need to handle it.
            // Let's assume for dropdown we want all schools or a searchable list.
            setSchools(Array.isArray(schoolData) ? schoolData : (schoolData as any).items || []);
            
            if (Array.isArray(schoolData) && schoolData.length > 0) setSchoolId(schoolData[0].id);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            let finalScope = visibilityScope;
            let finalValue = scopeValue;

            if (userType === 'EDGE_OPERATOR' || userType === 'SCHOOL_ADMIN') {
                finalScope = 'SCHOOL';
                finalValue = schoolId;
            } else if (userType === 'SUPER_ADMIN' || userType === 'NATIONAL_AUDITOR') {
                finalScope = 'NATIONAL';
                finalValue = 'ALL';
            }

            await apiFetch("/api/v1/maintenance/users", {
                method: "POST",
                body: JSON.stringify({ 
                    email, firstName, lastName, password, 
                    userType, schoolId: (finalScope === 'SCHOOL' ? schoolId : null),
                    visibilityScope: finalScope, 
                    scopeValue: finalValue 
                })
            });
            setEmail(""); setFirstName(""); setLastName("");
            loadData(offset);
        } catch (err) {
            alert("Failed to provision account");
        } finally {
            setIsSubmitting(false);
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
                    <p className="text-sm text-slate-500 font-medium">Provision hierarchical access for national, regional, and school personnel.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4">
                    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-100 bg-white sticky top-0">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <UserPlus className="h-5 w-5 text-indigo-600" />
                                Provision Account
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreate} className="space-y-4">
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
                                    <label className="text-[10px] font-black uppercase text-slate-400">Account Role</label>
                                    <select 
                                        className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900"
                                        value={userType}
                                        onChange={e => setUserType(e.target.value)}
                                    >
                                        <option value="EDGE_OPERATOR">Edge Operator</option>
                                        <option value="SCHOOL_ADMIN">School Admin</option>
                                        <option value="DEPED_MONITOR">DepEd Monitor (Read-only)</option>
                                        <option value="NATIONAL_AUDITOR">National Auditor (HQ)</option>
                                        <option value="SUPER_ADMIN">National Admin (Super)</option>
                                    </select>
                                </div>

                                {userType === 'DEPED_MONITOR' && (
                                    <div className="p-4 bg-indigo-50/50 rounded-2xl space-y-4 border border-indigo-100 animate-in zoom-in-95 duration-200">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-indigo-600">Visibility Scope</label>
                                            <select 
                                                className="w-full h-10 px-3 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-slate-900"
                                                value={visibilityScope}
                                                onChange={e => setVisibilityScope(e.target.value)}
                                            >
                                                <option value="NATIONAL">National (Global)</option>
                                                <option value="REGIONAL">Regional (By Region)</option>
                                                <option value="DIVISION">Division (By City)</option>
                                            </select>
                                        </div>
                                        {visibilityScope !== 'NATIONAL' && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-indigo-600">Target {visibilityScope === 'REGIONAL' ? 'Region' : 'Division'}</label>
                                                <Input 
                                                    placeholder={visibilityScope === 'REGIONAL' ? "e.g. NCR" : "e.g. Manila"} 
                                                    value={scopeValue} 
                                                    onChange={e => setScopeValue(e.target.value)} 
                                                    className="bg-white border-indigo-200"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {['EDGE_OPERATOR', 'SCHOOL_ADMIN'].includes(userType) && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Institutional Assignment</label>
                                        <select 
                                            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900"
                                            value={schoolId}
                                            onChange={e => setSchoolId(e.target.value)}
                                        >
                                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-indigo-100 mt-4" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deploy Credentials"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-8 flex flex-col">
                    <Card className="rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-slate-100 bg-white flex flex-col flex-1">
                        <div className="flex-1">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-slate-100 hover:bg-transparent">
                                        <TableHead className="pl-8 text-[9px] font-black uppercase text-slate-400 h-12">Authorized Personnel</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Role & Scope</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Authorization</TableHead>
                                        <TableHead className="pr-8 text-right text-[9px] font-black uppercase text-slate-400 h-12">Identity</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={4} className="h-80 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                                    ) : users.map((u) => (
                                        <TableRow key={u.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
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
                                                        u.userType === 'SUPER_ADMIN' ? "bg-slate-900 text-white" : 
                                                        u.userType === 'NATIONAL_AUDITOR' ? "bg-amber-100 text-amber-700" :
                                                        u.userType === 'DEPED_MONITOR' ? "bg-emerald-100 text-emerald-700" :
                                                        "bg-indigo-50 text-indigo-600"
                                                    )}>
                                                        {ROLE_LABELS[u.userType] || u.userType}
                                                    </Badge>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                                        {u.visibilityScope === 'NATIONAL' && <Globe className="h-2.5 w-2.5" />}
                                                        {u.visibilityScope === 'REGIONAL' && <Map className="h-2.5 w-2.5" />}
                                                        {u.visibilityScope === 'SCHOOL' && <School className="h-2.5 w-2.5" />}
                                                        {u.visibilityScope}: {u.scopeValue || '---'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={cn("h-1.5 w-1.5 rounded-full", u.isActive ? "bg-emerald-500" : "bg-slate-300")}></div>
                                                    <span className="text-[9px] font-black text-slate-500 uppercase">{u.isActive ? "Active" : "Revoked"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="pr-8 text-right text-[10px] font-mono text-slate-300 uppercase tracking-tighter">
                                                {u.id.substring(0, 13)}...
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
