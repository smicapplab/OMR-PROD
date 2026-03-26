import { useState, useEffect } from "react";
import { OMRField } from "./types";
import { apiFetch } from "@/lib/api";
import { Select } from "@/components/ui/select";

interface SchoolSelectProps {
    label: string;
    path: string[];
    fieldData: OMRField;
    onUpdate: (path: string[], val: string) => void;
}

interface School {
    id: string;
    name: string;
    code: string;
}

export function SchoolSelect({ label, path, fieldData, onUpdate }: SchoolSelectProps) {
    const [schools, setSchools] = useState<School[]>([]);

    useEffect(() => {
        apiFetch<School[]>("/api/v1/schools")
            .then(data => setSchools(data))
            .catch(err => console.error("Failed to fetch schools:", err));
    }, []);

    // Wait until fields are structurally mounted by OMR processor
    if (!fieldData) return null;

    const rawCode = fieldData.answer as string;

    // Resolve the internal code backwards into a beautifully formatted string Label
    const selectedSchool = schools.find(s => s.code === rawCode || s.id === rawCode);
    const displayValue = selectedSchool ? `${selectedSchool.name} (${selectedSchool.code})` : rawCode;

    // Generate valid pure-string list of formatted schools to trick generic UI component
    const options = schools.map(s => `${s.name} (${s.code})`);

    return (
        <div className="space-y-3">
            <label className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">{label}</label>
            <Select
                value={displayValue}
                onValueChange={(val) => {
                    // Reverse map back from "School Name (123456)" -> "123456" before saving!
                    const match = val.match(/\(([^)]+)\)$/);
                    if (match && match[1]) {
                        onUpdate(path, match[1]);
                    } else {
                        onUpdate(path, val);
                    }
                }}
                options={options}
                placeholder={`Search offline directory...`}
            />
        </div>
    );
}
