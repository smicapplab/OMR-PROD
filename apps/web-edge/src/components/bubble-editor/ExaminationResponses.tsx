"use client";

import { CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OMRRawData } from "./types";
import { CollapsibleSection } from "./CollapsibleSection";

interface ExaminationResponsesProps {
    subjects: string[];
    localData: OMRRawData;
    onUpdateAnswer: (subject: string, qNum: string, choice: string | null) => void;
}

export function ExaminationResponses({ subjects, localData, onUpdateAnswer }: ExaminationResponsesProps) {
    if (!localData?.answers) return null;

    return (
        <ScrollArea className="h-full w-full">
            <div className="py-6 space-y-6 pb-16 px-6">
                <div className="flex items-center gap-2 border-b pb-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600">5. Examination Responses</h3>
                </div>
                {subjects.map((subject) => (
                    <CollapsibleSection key={subject} title={subject} defaultOpen={false}>
                        <div className="flex flex-col gap-1 pt-4">
                            {Object.entries(localData.answers[subject] || {}).map(([qNum, qData]) => (
                                <div key={qNum} className="flex items-center gap-6 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                    <span className="w-6 text-[11px] text-slate-300">{qNum}</span>
                                    <div className="flex gap-2">
                                        {['A', 'B', 'C', 'D'].map(choice => (
                                            <button
                                                key={choice}
                                                onClick={() => onUpdateAnswer(subject, qNum, choice)}
                                                className={cn(
                                                    "h-8 w-8 rounded-full border-2 flex items-center justify-center text-[10px] transition-all",
                                                    qData.answer === choice ? "bg-slate-900 border-slate-900 text-white shadow-lg scale-110" : "bg-white border-slate-200 text-slate-400 hover:border-indigo-400"
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
                    </CollapsibleSection>
                ))}
            </div>
        </ScrollArea>
    );
}
