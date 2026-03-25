"use client";

import { Heart, School, GraduationCap } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OMRRawData } from "@omr-prod/contracts";
import { CollapsibleSection } from "./CollapsibleSection";
import { CategoricalSelect } from "./CategoricalSelect";
import { SimpleToggle } from "./SimpleToggle";
import { MultiSelect } from "./MultiSelect";
import { OMRTextInput } from "./OMRTextInput";

interface StudentProfileProps {
    localData: OMRRawData;
    onUpdateField: (path: string[], val: any) => void;
    onUpdateBubble: (path: string[], choice: string | null, colIdx: string) => void;
    onUpdateText: (path: string[], val: string) => void;
}

export function StudentProfile({ localData, onUpdateField, onUpdateBubble, onUpdateText }: StudentProfileProps) {
    if (!localData?.student_info) return null;

    const years = Array.from({ length: 100 }, (_, i) => (2000 + i).toString());

    return (
        <ScrollArea className="h-full w-full">
            <div className="py-6 space-y-8 pb-16 px-6">

                <CollapsibleSection title="1. Identity & Profile" defaultOpen={true}>
                    <div className="space-y-6 pt-2">
                        <OMRTextInput label="Last Name" path={["last_name"]} fieldData={localData.student_info.last_name} onUpdate={onUpdateText} />
                        <OMRTextInput label="First Name" path={["first_name"]} fieldData={localData.student_info.first_name} onUpdate={onUpdateText} />
                        <OMRTextInput label="Middle Initial (MI)" path={["middle_initial"]} fieldData={localData.student_info.middle_initial} onUpdate={onUpdateText} maxLength={1} />
                        <OMRTextInput label="LRN (12 Digits)" path={["lrn"]} fieldData={localData.student_info.lrn} onUpdate={onUpdateText} isNumeric={true} maxLength={12} padLength={12} />

                        <CategoricalSelect label="Gender" path={["gender"]} fieldData={localData.student_info.gender} onUpdate={onUpdateField} />
                        <SimpleToggle label="Special Science Curriculum (SSC)" path={["ssc"]} fieldData={localData.student_info.ssc} onUpdate={onUpdateField} />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dashed">
                            <OMRTextInput label="Birth Month" path={["birth_month"]} fieldData={localData.student_info.birth_month} onUpdate={onUpdateText} isNumeric={true} maxLength={2} padLength={2} min={1} max={12} />
                            <OMRTextInput label="Birth Day" path={["birth_day"]} fieldData={localData.student_info.birth_day} onUpdate={onUpdateText} isNumeric={true} maxLength={2} padLength={2} min={1} max={31} />

                            <CategoricalSelect
                                label="Birth Year"
                                path={["birth_year"]}
                                fieldData={{
                                    ...localData.student_info.birth_year,
                                    answer: localData.student_info.birth_year.answer
                                        ? `20${localData.student_info.birth_year.answer.toString().slice(-2)}`
                                        : ""
                                }}
                                onUpdate={(path, val) => onUpdateText(path, val.slice(-2))}
                                options={years}
                            />
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="2. Social & Welfare" icon={Heart}>
                    <div className="space-y-6 pt-2">
                        <CategoricalSelect label="4Ps Beneficiary" path={["four_ps"]} fieldData={localData.student_info.four_ps} onUpdate={onUpdateField} />
                        <MultiSelect label="Special Programs / Classes" path={["special_classes"]} fieldData={localData.student_info.special_classes} onUpdate={onUpdateField} />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="3. Current Institution" icon={School}>
                    <div className="space-y-6 pt-2">
                        <CategoricalSelect label="Region" path={["current_school", "region"]} fieldData={localData.student_info.current_school?.region} onUpdate={onUpdateField} />
                        <OMRTextInput label="Division" path={["current_school", "division"]} fieldData={localData.student_info.current_school?.division} onUpdate={onUpdateText} isNumeric={true} maxLength={2} padLength={2} />
                        <OMRTextInput label="School ID" path={["current_school", "school_id"]} fieldData={localData.student_info.current_school?.school_id} onUpdate={onUpdateText} isNumeric={true} maxLength={6} padLength={6} />
                        <CategoricalSelect label="School Type" path={["current_school", "school_type"]} fieldData={localData.student_info.current_school?.school_type} onUpdate={onUpdateField} />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="4. Academic History" icon={GraduationCap}>
                    <div className="space-y-6 pt-2">
                        <CategoricalSelect label="School Year (SY)" path={["previous_school", "school_year"]} fieldData={localData.student_info.previous_school?.school_year} onUpdate={onUpdateField} />
                        <OMRTextInput label="Previous School ID" path={["previous_school", "school_id"]} fieldData={localData.student_info.previous_school?.school_id} onUpdate={onUpdateText} isNumeric={true} maxLength={6} padLength={6} />
                        <OMRTextInput label="Class Size" path={["previous_school", "class_size"]} fieldData={localData.student_info.previous_school?.class_size} onUpdate={onUpdateText} isNumeric={true} maxLength={2} padLength={2} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-dashed">
                            {Object.keys(localData.student_info.previous_school?.grades || {}).map(sub =>
                                <OMRTextInput
                                    key={sub}
                                    label={`${sub} Grade`}
                                    path={["previous_school", "grades", sub]}
                                    fieldData={localData.student_info.previous_school.grades[sub]}
                                    onUpdate={onUpdateText}
                                    isNumeric={true}
                                    maxLength={2}
                                    padLength={2}
                                    min={70}
                                    max={99}
                                />
                            )}
                        </div>
                    </div>
                </CollapsibleSection>
            </div>
        </ScrollArea>
    );
}
