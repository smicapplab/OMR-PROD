"use client";

import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

import { BubbleEditorProps, OMRRawData } from "./types";
import { StudentProfile } from "./StudentProfile";
import { ExaminationResponses } from "./ExaminationResponses";
import { OMRTextInput } from "./OMRTextInput";
import { LucideIcon } from "lucide-react";

interface StudentProfileProps {
    localData: OMRRawData;
    onUpdateField: (path: string[], val: string | string[]) => void;
    onUpdateText: (path: string[], val: string) => void;
}

interface CollapsibleSectionProps {
    title: string;
    icon?: LucideIcon;
    onUpdateField: (path: string[], val: string | string[]) => void;
    onUpdateText: (path: string[], val: string) => void;
}

export function BubbleEditor({ scan, isOpen, onClose, onSaved }: BubbleEditorProps) {
    const [localData, setLocalData] = useState<OMRRawData>(structuredClone(scan.rawData));
    const [reason, setReason] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Sync state when scan prop changes
    useEffect(() => {
        if (scan?.rawData) {
            setLocalData(structuredClone(scan.rawData));
        }
    }, [scan]);

    // Reset reason when modal opens
    useEffect(() => {
        if (isOpen) {
            setReason("");
        }
    }, [isOpen]);

    const subjects = useMemo(() => Object.keys(localData?.answers || {}), [localData]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiFetch(`/api/v1/scans/${scan.id}`, {
                method: "PATCH",
                body: JSON.stringify({ raw_data: localData, review_required: false, reason }),
            });
            onSaved();
            onClose();
        } catch (err) {
            console.error("Failed to save correction", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateField = (path: string[], val: string | string[]) => {
        const newData = { ...localData };
        let current: any = newData.student_info;
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }
        current[path[path.length - 1]].answer = val;
        current[path[path.length - 1]].is_manual = true;
        setLocalData({ ...newData });
    };

    const handleUpdateTextField = (path: string[], val: string) => {
        const newData = { ...localData };
        let current: any = newData.student_info;
        for (let i = 0; i < path.length; i++) current = current[path[i]];

        current.answer = val;
        current.is_manual = true;

        const details = current.details?.digits ? current.details.digits : current.details;
        const colKeys = Object.keys(details)
            .filter(k => !isNaN(Number(k)))
            .sort((a, b) => Number(a) - Number(b));

        colKeys.forEach((colIdx, i) => {
            const char = val[i] || null;
            if (char && details[colIdx].scores && details[colIdx].scores[char] !== undefined) {
                details[colIdx].selected = char;
            } else {
                details[colIdx].selected = null;
            }
        });

        setLocalData({ ...newData });
    };

    const handleUpdateAnswer = (subject: string, qNum: string, choice: string | null) => {
        const newData = { ...localData };
        if (!newData.answers[subject]) return;
        newData.answers[subject][qNum].answer = choice;
        newData.answers[subject][qNum].is_manual = true;
        setLocalData({ ...newData });
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="sm:max-w-3xl w-full flex flex-col h-full bg-white p-0 shadow-2xl border-l outline-none">
                <SheetHeader className="p-6 border-b bg-slate-50 shrink-0">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <Save className="h-4 w-4 text-white" />
                        </div>
                        <SheetTitle className="text-xl font-bold text-slate-900 uppercase tracking-tight">Data Correction</SheetTitle>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-hidden relative flex flex-col">
                    <Tabs defaultValue="student" className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 py-2 border-b bg-slate-50/50">
                            <TabsList className="grid w-full grid-cols-2 h-9 rounded-lg bg-slate-200/50 p-1">
                                <TabsTrigger value="student" className="rounded-md text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                    Student Profile
                                </TabsTrigger>
                                <TabsTrigger value="answers" className="rounded-md text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm">
                                    Exam Responses
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-hidden">
                            <TabsContent value="student" className="h-full m-0 outline-none">
                                <StudentProfile
                                    localData={localData}
                                    onUpdateField={handleUpdateField}
                                    onUpdateText={handleUpdateTextField}
                                />
                            </TabsContent>

                            <TabsContent value="answers" className="h-full m-0 outline-none">
                                <ExaminationResponses subjects={subjects} localData={localData} onUpdateAnswer={handleUpdateAnswer} />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                <SheetFooter className="p-6 border-t bg-slate-50 shrink-0">
                    <div className="flex flex-col w-full gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Correction Justification (Mandatory)</label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g., Erased bubble detected but Student clearly marked choice B"
                                className="w-full h-20 rounded-xl border border-slate-200 bg-white p-3 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                            />
                        </div>
                        <div className="flex w-full gap-4">
                            <Button variant="outline" className="flex-1 h-11 rounded-xl border-slate-200 font-bold" onClick={onClose}>Discard</Button>
                            <Button
                                className="flex-[2] h-11 bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 rounded-xl gap-3 font-bold uppercase tracking-wider transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
                                onClick={handleSave}
                                disabled={isSaving || !reason.trim()}
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Verify & Commit
                            </Button>
                        </div>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
