"use client";

import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { 
    Save, Loader2, School, GraduationCap, 
    CheckCircle2, Square, CheckSquare, Heart 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Scan } from "@omr-prod/contracts";

// --- OMR DATA INTERFACES ---

interface OMRScore {
    [choice: string]: number;
}

interface OMRDetailColumn {
    selected: string | null;
    confidence: number;
    status: string;
    scores: OMRScore;
}

interface OMRFieldDetails {
    [colIdx: string]: OMRDetailColumn;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    digits?: any; // Fallback for nested digits structure
}

interface OMRField {
    answer: string | string[];
    confidence: number;
    review_required: boolean;
    details: OMRFieldDetails;
    is_manual?: boolean;
}

interface AnswerData {
    answer: string | null;
    confidence: number;
    review_required: boolean;
    scores: OMRScore;
    is_manual?: boolean;
}

interface OMRRawData {
    student_info: {
        last_name: OMRField;
        first_name: OMRField;
        middle_initial: OMRField;
        lrn: OMRField;
        birth_month: OMRField;
        birth_day: OMRField;
        birth_year: OMRField;
        ssc: OMRField;
        gender: OMRField;
        four_ps: OMRField;
        special_classes: OMRField;
        current_school: {
            region: OMRField;
            division: OMRField;
            school_id: OMRField;
            school_type: OMRField;
        };
        previous_school: {
            school_id: OMRField;
            school_year: OMRField;
            class_size: OMRField;
            grades: {
                [subject: string]: OMRField;
            };
        };
    };
    answers: {
        [subject: string]: {
            [questionNumber: string]: AnswerData;
        };
    };
}

interface BubbleEditorProps {
    scan: Scan;
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export function BubbleEditor({ scan, isOpen, onClose, onSaved }: BubbleEditorProps) {
    const [localData, setLocalData] = useState<OMRRawData>(JSON.parse(JSON.stringify(scan.rawData)));
    const [isSaving, setIsSaving] = useState(false);

    const subjects = useMemo(() => Object.keys(localData?.answers || {}), [localData]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiFetch(`/api/v1/scans/${scan.id}`, {
                method: "PATCH",
                body: JSON.stringify({ raw_data: localData, review_required: false }),
            });
            onSaved();
            onClose();
        } catch (err) {
            console.error("Failed to save correction", err);
        } finally {
            setIsSaving(false);
        }
    };

    const updateNestedField = (path: string[], val: string | string[]) => {
        const newData = { ...localData };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let current: any = newData.student_info;
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }
        current[path[path.length-1]].answer = val;
        current[path[path.length-1]].is_manual = true;
        setLocalData({ ...newData });
    };

    const renderBubbleGrid = (label: string, path: string[], fieldData: OMRField) => {
        if (!fieldData) return null;
        const cols = fieldData.details?.digits ? fieldData.details.digits : fieldData.details;
        if (!cols) return null;

        return (
            <div key={label} className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</label>
                <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                    {Object.entries(cols as Record<string, OMRDetailColumn>).map(([colIdx, d]) => (
                        <div key={colIdx} className="flex flex-col items-center gap-1.5">
                            <span className="text-[8px] font-black text-slate-300 uppercase">Col {Number(colIdx)+1}</span>
                            <div className="flex flex-col gap-1">
                                {Object.keys(d.scores || {}).sort().map(choice => (
                                    <button
                                        key={choice}
                                        onClick={() => {
                                            const newData = { ...localData };
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            let current: any = newData.student_info;
                                            for (let i = 0; i < path.length; i++) current = current[path[i]];
                                            const details = current.details?.digits ? current.details.digits : current.details;
                                            details[colIdx].selected = details[colIdx].selected === choice ? null : choice;
                                            const chars = Object.keys(details).sort((a,b) => Number(a)-Number(b)).map(k => details[k].selected || " ");
                                            current.answer = chars.join("").trim();
                                            setLocalData({ ...newData });
                                        }}
                                        className={cn(
                                            "h-6 w-6 rounded-md border flex items-center justify-center text-[9px] font-black transition-all",
                                            d.selected === choice ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:border-indigo-300"
                                        )}
                                    >
                                        {choice}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderCategoricalSelect = (label: string, path: string[], fieldData: OMRField) => {
        if (!fieldData || !fieldData.details) return null;
        
        const columnZero = fieldData.details["0"] || Object.values(fieldData.details)[0];
        const options = Object.keys(columnZero?.scores || {});
        
        if (options.length === 0) return null;

        return (
            <div key={label} className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</label>
                <div className="grid grid-cols-1 gap-1">
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => updateNestedField(path, opt)}
                            className={cn(
                                "flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all",
                                fieldData.answer === opt 
                                    ? "bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm" 
                                    : "bg-white border-slate-100 text-slate-600 hover:border-slate-200 shadow-sm"
                            )}
                        >
                            <span className="text-xs font-bold">{opt}</span>
                            {fieldData.answer === opt && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderSimpleToggle = (label: string, path: string[], fieldData: OMRField) => {
        if (!fieldData) return null;
        const isActive = fieldData.answer === "SELECTED" || fieldData.answer === "Yes";
        
        return (
            <div key={label} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-tight">{label}</label>
                <button 
                    onClick={() => updateNestedField(path, isActive ? "No" : "Yes")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all font-black text-[10px] uppercase shadow-sm",
                        isActive ? "bg-emerald-500 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                    )}
                >
                    {isActive ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    {isActive ? "Active" : "None"}
                </button>
            </div>
        );
    };

    const renderMultiSelect = (label: string, path: string[], fieldData: OMRField) => {
        if (!fieldData || !fieldData.details) return null;
        const columnZero = fieldData.details["0"] || Object.values(fieldData.details)[0];
        const options = Object.keys(columnZero?.scores || {});
        
        const selected = Array.isArray(fieldData.answer) ? fieldData.answer : [fieldData.answer].filter(v => v && v !== " ");

        const toggle = (opt: string) => {
            let next;
            if (selected.includes(opt)) next = selected.filter(s => s !== opt);
            else next = [...selected, opt];
            updateNestedField(path, next);
        };

        return (
            <div key={label} className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</label>
                <div className="grid grid-cols-1 gap-1">
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => toggle(opt)}
                            className={cn(
                                "flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all",
                                selected.includes(opt)
                                    ? "bg-emerald-50 border-emerald-600 text-emerald-700 shadow-sm" 
                                    : "bg-white border-slate-100 text-slate-600 hover:border-slate-200 shadow-sm"
                            )}
                        >
                            <span className="text-xs font-bold">{opt}</span>
                            {selected.includes(opt) && <CheckSquare className="h-4 w-4 text-emerald-600" />}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="sm:max-w-3xl w-full flex flex-col h-full bg-white p-0 shadow-2xl border-l outline-none">
                <SheetHeader className="p-6 border-b bg-slate-50 flex-shrink-0">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <Save className="h-4 w-4 text-white" />
                        </div>
                        <SheetTitle className="text-xl font-bold text-slate-900 uppercase tracking-tight">Forensic Adjustment</SheetTitle>
                    </div>
                    <SheetDescription className="text-slate-500 font-medium truncate">
                        Student LRN: <span className="font-bold text-indigo-600">{localData.student_info?.lrn?.answer}</span>
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-hidden relative">
                    <ScrollArea className="h-full w-full">
                        <div className="py-6 space-y-12 pb-32 px-6">
                            
                            {/* 1. Identity & Profile */}
                            <section className="space-y-6">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600 border-b pb-2">1. Identity & Profile</h3>
                                {renderBubbleGrid("LRN (12 Digits)", ["lrn"], localData.student_info.lrn)}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {renderCategoricalSelect("Gender", ["gender"], localData.student_info.gender)}
                                    {renderSimpleToggle("Special Science Curriculum (SSC)", ["ssc"], localData.student_info.ssc)}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dashed">
                                    {renderBubbleGrid("Birth Month", ["birth_month"], localData.student_info.birth_month)}
                                    {renderBubbleGrid("Birth Day", ["birth_day"], localData.student_info.birth_day)}
                                    {renderBubbleGrid("Birth Year", ["birth_year"], localData.student_info.birth_year)}
                                </div>
                            </section>

                            {/* 2. Social & Welfare */}
                            <section className="space-y-6">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600 border-b pb-2 flex items-center gap-2">
                                    <Heart className="h-4 w-4" /> 2. Social & Welfare
                                </h3>
                                {renderCategoricalSelect("4Ps Beneficiary", ["four_ps"], localData.student_info.four_ps)}
                                {renderMultiSelect("Special Programs / Classes", ["special_classes"], localData.student_info.special_classes)}
                            </section>

                            {/* 3. Current Institution */}
                            <section className="space-y-6">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600 border-b pb-2 flex items-center gap-2">
                                    <School className="h-4 w-4" /> 3. Current Institution
                                </h3>
                                {renderCategoricalSelect("Region", ["current_school", "region"], localData.student_info.current_school?.region)}
                                {renderBubbleGrid("Division", ["current_school", "division"], localData.student_info.current_school?.division)}
                                {renderBubbleGrid("School ID", ["current_school", "school_id"], localData.student_info.current_school?.school_id)}
                                {renderCategoricalSelect("School Type", ["current_school", "school_type"], localData.student_info.current_school?.school_type)}
                            </section>

                            {/* 4. Academic History */}
                            <section className="space-y-6">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600 border-b pb-2 flex items-center gap-2">
                                    <GraduationCap className="h-4 w-4" /> 4. Academic History
                                </h3>
                                {renderCategoricalSelect("School Year (SY)", ["previous_school", "school_year"], localData.student_info.previous_school?.school_year)}
                                {renderBubbleGrid("Previous School ID", ["previous_school", "school_id"], localData.student_info.previous_school?.school_id)}
                                {renderBubbleGrid("Class Size", ["previous_school", "class_size"], localData.student_info.previous_school?.class_size)}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-dashed">
                                    {Object.keys(localData.student_info.previous_school?.grades || {}).map(sub => 
                                        renderBubbleGrid(`${sub} Grade`, ["previous_school", "grades", sub], localData.student_info.previous_school.grades[sub])
                                    )}
                                </div>
                            </section>

                            {/* 5. Exam Answers */}
                            <section className="space-y-10">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600 border-b pb-2">5. Examination Responses</h3>
                                {subjects.map(subject => (
                                    <div key={subject} className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{subject}</h4>
                                        <div className="flex flex-col gap-1">
                                            {Object.entries(localData.answers[subject]).map(([qNum, qData]) => (
                                                <div key={qNum} className="flex items-center gap-6 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                                    <span className="w-6 text-[11px] font-black text-slate-300">{qNum}</span>
                                                    <div className="flex gap-2">
                                                        {['A', 'B', 'C', 'D'].map(choice => (
                                                            <button
                                                                key={choice}
                                                                onClick={() => {
                                                                    const newData = { ...localData };
                                                                    const cur = newData.answers[subject][qNum].answer;
                                                                    newData.answers[subject][qNum].answer = cur === choice ? null : choice;
                                                                    newData.answers[subject][qNum].is_manual = true;
                                                                    setLocalData({ ...newData });
                                                                }}
                                                                className={cn(
                                                                    "h-8 w-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all",
                                                                    localData.answers[subject][qNum].answer === choice ? "bg-slate-900 border-slate-900 text-white shadow-lg scale-110" : "bg-white border-slate-200 text-slate-400 hover:border-indigo-400"
                                                                )}
                                                            >
                                                                {choice}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {qData.is_manual && <Badge className="bg-indigo-500 text-white border-none text-[8px] h-4 uppercase px-1.5">Edited</Badge>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </section>
                        </div>
                    </ScrollArea>
                </div>

                <SheetFooter className="p-6 border-t bg-slate-50 flex-shrink-0">
                    <div className="flex w-full gap-4">
                        <Button variant="outline" className="flex-1 h-11 rounded-xl border-slate-200 font-bold" onClick={onClose}>Discard</Button>
                        <Button className="flex-[2] h-11 bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 rounded-xl gap-3 font-bold uppercase tracking-wider transition-all active:scale-95" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Verify & Commit
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
