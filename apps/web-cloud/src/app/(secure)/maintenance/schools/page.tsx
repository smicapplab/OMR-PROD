"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { 
    School, Plus, MapPin, Loader2, Building2, Globe, Map, Filter, ChevronLeft, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SchoolData {
    id: string;
    name: string;
    code: string;
    division: string;
    address: string;
    createdAt: string;
    regionName: string;
}

interface RegionData {
    id: string;
    name: string;
}

interface PaginatedResponse {
    items: SchoolData[];
    total: number;
    limit: number;
    offset: number;
}

export default function SchoolsManagement() {
    const [schools, setSchools] = useState<SchoolData[]>([]);
    const [regions, setRegions] = useState<RegionData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const LIMIT = 10;
    
    // Filters
    const [filterRegion, setFilterRegion] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    // Form State
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [regionId, setRegionId] = useState("");
    const [division, setDivision] = useState("");
    const [address, setAddress] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function loadData(currentOffset = 0) {
        setIsLoading(true);
        try {
            const [schoolRes, regionData] = await Promise.all([
                apiFetch<PaginatedResponse>("/api/v1/maintenance/schools", { 
                    params: { limit: LIMIT, offset: currentOffset } 
                }),
                apiFetch<RegionData[]>("/api/v1/maintenance/regions")
            ]);
            setSchools(schoolRes.items);
            setTotal(schoolRes.total);
            setRegions(regionData);
            if (regionData.length > 0) setRegionId(regionData[0].id);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    const filteredSchools = useMemo(() => {
        return schools.filter(s => {
            const matchesRegion = filterRegion === "ALL" || s.regionName === filterRegion;
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 s.code.includes(searchQuery);
            return matchesRegion && matchesSearch;
        });
    }, [schools, filterRegion, searchQuery]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await apiFetch("/api/v1/maintenance/schools", {
                method: "POST",
                body: JSON.stringify({ name, code, regionId, division, address })
            });
            setName(""); setCode(""); setDivision(""); setAddress("");
            loadData(offset);
        } catch (err) {
            alert("Failed to create school");
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
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Institution Registry</h2>
                    <p className="text-sm text-slate-500 font-medium">Manage the nationwide network of authorized testing centers.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Registration Form */}
                <div className="lg:col-span-4">
                    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-100 bg-white sticky top-0">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-indigo-600" />
                                Enroll Institution
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 leading-none">School Name</label>
                                    <Input placeholder="e.g. Manila Science HS" value={name} onChange={e => setName(e.target.value)} required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 leading-none">DepEd ID</label>
                                        <Input placeholder="305312" value={code} onChange={e => setCode(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 leading-none">Region</label>
                                        <select 
                                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={regionId}
                                            onChange={e => setRegionId(e.target.value)}
                                        >
                                            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 leading-none">Street Address</label>
                                    <Input placeholder="123 Education St." value={address} onChange={e => setAddress(e.target.value)} />
                                </div>
                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl h-11 font-bold shadow-lg shadow-indigo-100 mt-2" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registry Institution"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* List Table */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Filter Bar */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                            <input 
                                type="text" 
                                placeholder="Search by name or DepEd ID..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 bg-white border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm text-slate-900"
                            />
                        </div>
                        <select 
                            className="h-11 px-4 bg-white border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-slate-900"
                            value={filterRegion}
                            onChange={e => setFilterRegion(e.target.value)}
                        >
                            <option value="ALL">All Regions</option>
                            {regions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </select>
                    </div>

                    <Card className="rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-slate-100 bg-white flex flex-col">
                        <div className="flex-1">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-slate-100">
                                        <TableHead className="pl-8 text-[9px] font-black uppercase text-slate-400 h-12">Institution</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Hierarchy</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 h-12">Identity</TableHead>
                                        <TableHead className="pr-8 text-right text-[9px] font-black uppercase text-slate-400 h-12">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={4} className="h-80 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                                    ) : filteredSchools.length > 0 ? filteredSchools.map((s) => (
                                        <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                                            <TableCell className="pl-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 text-sm uppercase">{s.name}</span>
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                                                        <MapPin className="h-2.5 w-2.5" /> {s.address || 'No street address'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5">
                                                        <Globe className="h-3 w-3 text-indigo-400" />
                                                        <span className="text-[10px] font-black text-slate-600 uppercase leading-none">{s.regionName || 'NCR'}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 text-slate-600 border-none px-2 h-5">ID: {s.code}</Badge>
                                            </TableCell>
                                            <TableCell className="pr-8 text-right">
                                                <Badge className="bg-emerald-50 text-emerald-600 border-none text-[9px] font-black uppercase h-5 px-2">Verified</Badge>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-40 text-center text-slate-400 italic font-medium">No institutions matching filters.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="p-4 border-t bg-slate-50/30 flex items-center justify-between">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">
                                Page {currentPage} of {totalPages || 1} <span className="mx-2 opacity-30">•</span> {total} Institutions
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
