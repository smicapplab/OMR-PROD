"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
    Globe, Plus, Loader2, Map, Bookmark, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface RegionData {
    id: string;
    name: string;
    code: string;
    description: string;
    createdAt: string;
}

export default function RegionsManagement() {
    const [regions, setRegions] = useState<RegionData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function loadRegions() {
        setIsLoading(true);
        try {
            const data = await apiFetch<RegionData[]>("/api/v1/maintenance/regions");
            setRegions(data);
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
            await apiFetch("/api/v1/maintenance/regions", {
                method: "POST",
                body: JSON.stringify({ name, code, description })
            });
            setName(""); setCode(""); setDescription("");
            loadRegions();
        } catch (err) {
            alert("Failed to create region");
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        loadRegions();
    }, []);

    return (
        <div className="flex-1 p-10 space-y-10 max-w-7xl mx-auto overflow-y-auto h-screen pb-32">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Geographical Registry</h2>
                    <p className="text-sm text-slate-500 font-medium">Define the regional boundaries for national monitoring.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Registration Form */}
                <div className="lg:col-span-1">
                    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-100 bg-white">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Globe className="h-5 w-5 text-indigo-600" />
                                Register Region
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Region Name</label>
                                    <Input placeholder="e.g. NCR" value={name} onChange={e => setName(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Short Code</label>
                                    <Input placeholder="REG-01" value={code} onChange={e => setCode(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Official Description</label>
                                    <Input placeholder="National Capital Region" value={description} onChange={e => setDescription(e.target.value)} />
                                </div>
                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl h-11 font-bold shadow-lg shadow-indigo-100" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registry Region"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* List Table */}
                <div className="lg:col-span-2">
                    <Card className="rounded-3xl border-none shadow-sm overflow-hidden ring-1 ring-slate-100 bg-white">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-slate-100">
                                    <TableHead className="pl-8 text-[10px] font-black uppercase text-slate-400 h-12">Region</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 h-12">Code</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 h-12">Description</TableHead>
                                    <TableHead className="pr-8 text-right text-[10px] font-black uppercase text-slate-400 h-12">Integrity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                                ) : regions.map((r) => (
                                    <TableRow key={r.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                                        <TableCell className="pl-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-[10px]">
                                                    {r.name.substring(0, 3)}
                                                </div>
                                                <span className="font-bold text-slate-900 text-sm uppercase">{r.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 text-slate-600 border-none px-2">{r.code}</Badge>
                                        </TableCell>
                                        <TableCell className="text-[10px] font-bold text-slate-400 uppercase">{r.description || '---'}</TableCell>
                                        <TableCell className="pr-8 text-right">
                                            <Badge className="bg-emerald-50 text-emerald-600 border-none text-[9px] font-black uppercase h-5">Authoritative</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            </div>
        </div>
    );
}
