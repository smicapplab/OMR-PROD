"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
    FileCheck, Plus, Loader2, Save, FileEdit, Trash2,
    ChevronRight, CheckCircle2, AlertCircle, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AnswerKey {
    id: string;
    examName: string;
    subject: string;
    version: string;
    answers: Record<string, string>;
    updatedAt: string;
}

export default function AnswerKeysManagement() {
    const [keys, setKeys] = useState<AnswerKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Editor State
    const [selectedKey, setSelectedKey] = useState<AnswerKey | null>(null);
    const [editExamName, setEditExamName] = useState("");
    const [editSubject, setEditSubject] = useState("math");
    const [editVersion, setEditVersion] = useState("2026-V1");
    const [editAnswers, setEditAnswers] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    async function loadKeys() {
        setIsLoading(true);
        try {
            const data = await apiFetch<AnswerKey[]>("/api/v1/maintenance/keys");
            setKeys(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    const resetEditor = () => {
        setSelectedKey(null);
        setEditExamName("National Standard Exam");
        setEditSubject("math");
        setEditVersion("2026-V1");
        const defaultAns: Record<string, string> = {};
        for (let i = 1; i <= 40; i++) defaultAns[i] = "A";
        setEditAnswers(defaultAns);
    };

    const handleSelect = (key: AnswerKey) => {
        setSelectedKey(key);
        setEditExamName(key.examName);
        setEditSubject(key.subject);
        setEditVersion(key.version);
        setEditAnswers(key.answers);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiFetch("/api/v1/maintenance/keys", {
                method: "POST",
                body: JSON.stringify({
                    id: selectedKey?.id,
                    examName: editExamName,
                    subject: editSubject,
                    version: editVersion,
                    answers: editAnswers
                })
            });
            loadKeys();
            setSelectedKey(null);
        } catch (err) {
            alert("Failed to save key");
        } finally {
            setIsSaving(false);
        }
    };

    const updateSingleAnswer = (qNum: string, val: string) => {
        setEditAnswers(prev => ({ ...prev, [qNum]: val }));
    };

    useEffect(() => {
        loadKeys();
        resetEditor();
    }, []);

    return (
        <div className="flex-1 p-10 space-y-10 max-w-7xl mx-auto overflow-y-auto h-screen pb-32">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Answer Master</h2>
                    <p className="text-sm text-slate-500 font-medium">Authoritative grading templates for the national exam network.</p>
                </div>
                <Button onClick={resetEditor} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold h-11 gap-2 shadow-lg shadow-indigo-100">
                    <Plus className="h-4 w-4" /> New Key Template
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Active Keys List */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="flex items-center gap-2 px-2 text-slate-400">
                        <FileCheck className="h-4 w-4" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest">Active Registrations</h3>
                    </div>

                    <div className="space-y-3">
                        {isLoading ? (
                            <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-200" /></div>
                        ) : keys.map((key) => (
                            <button
                                key={key.id}
                                onClick={() => handleSelect(key)}
                                className={cn(
                                    "w-full text-left p-5 rounded-2xl border-2 transition-all group",
                                    selectedKey?.id === key.id
                                        ? "bg-white border-indigo-600 shadow-md ring-4 ring-indigo-50"
                                        : "bg-white border-slate-100 hover:border-indigo-200 shadow-sm"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <Badge className="bg-indigo-50 text-indigo-600 border-none text-[9px] font-black px-2 uppercase">{key.subject}</Badge>
                                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">v{key.version}</span>
                                </div>
                                <p className="text-sm font-black text-slate-900 truncate uppercase mb-1">{key.examName}</p>
                                <p className="text-[10px] font-bold text-slate-400">Updated: {new Date(key.updatedAt).toLocaleDateString()}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Master Template Editor */}
                <div className="lg:col-span-8">
                    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-100 bg-white">
                        <CardHeader className="border-b bg-slate-50/50 rounded-t-3xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200">
                                        <FileEdit className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-black uppercase tracking-tight">Master Template Editor</CardTitle>
                                        <CardDescription className="text-xs font-medium">Configure the correct bubble pattern for automatic grading.</CardDescription>
                                    </div>
                                </div>
                                <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold h-11 px-6 shadow-lg shadow-emerald-100 gap-2">
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Commit Pattern
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="grid grid-cols-3 gap-6 mb-10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Exam Name</label>
                                    <Input value={editExamName} onChange={e => setEditExamName(e.target.value)} className="rounded-xl h-11" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Subject</label>
                                    <select className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={editSubject} onChange={e => setEditSubject(e.target.value)}>
                                        <option value="math">Mathematics</option>
                                        <option value="english">English</option>
                                        <option value="science">Science</option>
                                        <option value="filipino">Filipino</option>
                                        <option value="ap">Araling Panlipunan</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Version</label>
                                    <Input value={editVersion} onChange={e => setEditVersion(e.target.value)} className="rounded-xl h-11 font-mono" />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center gap-2 text-slate-400 border-b pb-2 mb-4">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    <h4 className="text-[10px] font-black uppercase tracking-widest">Correct Answer Mapping</h4>
                                </div>

                                <ScrollArea className="h-[450px] pr-4">
                                    <div className="grid grid-cols-4 gap-4 pb-10">
                                        {Object.keys(editAnswers).sort((a, b) => Number(a) - Number(b)).map((qNum) => (
                                            <div key={qNum} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-indigo-200 transition-all">
                                                <span className="w-6 text-[11px] font-black text-slate-300 group-hover:text-indigo-400 transition-colors">{qNum}</span>
                                                <div className="flex gap-1">
                                                    {['A', 'B', 'C', 'D'].map(choice => (
                                                        <button
                                                            key={choice}
                                                            onClick={() => updateSingleAnswer(qNum, choice)}
                                                            className={cn(
                                                                "h-7 w-7 rounded-lg text-[10px] font-black transition-all",
                                                                editAnswers[qNum] === choice
                                                                    ? "bg-slate-900 text-white shadow-md scale-110"
                                                                    : "bg-white text-slate-400 hover:bg-white hover:text-indigo-600 border border-slate-200"
                                                            )}
                                                        >
                                                            {choice}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
