"use client";

import { Input } from "@/components/ui/input";
import { OMRField } from "@omr-prod/contracts";

interface OMRTextInputProps {
    label: string;
    path: string[];
    fieldData: OMRField;
    onUpdate: (path: string[], val: string) => void;
    maxLength?: number;
    isNumeric?: boolean;
    padLength?: number;
    min?: number;
    max?: number;
}

export function OMRTextInput({ 
    label, 
    path, 
    fieldData, 
    onUpdate,
    maxLength,
    isNumeric,
    padLength,
    min,
    max
}: OMRTextInputProps) {
    if (!fieldData) return null;

    const currentValue = typeof fieldData.answer === "string" ? fieldData.answer : "";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.toUpperCase();
        
        if (isNumeric) {
            val = val.replace(/[^0-9]/g, "");
        }

        if (maxLength && val.length > maxLength) {
            val = val.substring(0, maxLength);
        }

        onUpdate(path, val);
    };

    const handleBlur = () => {
        let val = currentValue;

        // Apply padding if needed
        if (padLength && val.length > 0 && val.length < padLength) {
            val = val.padStart(padLength, "0");
        }

        // Apply range limits if needed
        if (isNumeric && val.length > 0) {
            const num = parseInt(val, 10);
            if (min !== undefined && num < min) val = min.toString().padStart(padLength || 0, "0");
            if (max !== undefined && num > max) val = max.toString().padStart(padLength || 0, "0");
        }

        if (val !== currentValue) {
            onUpdate(path, val);
        }
    };

    return (
        <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</label>
            <Input
                value={currentValue}
                onChange={handleChange}
                onBlur={handleBlur}
                className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all uppercase"
                placeholder={`Enter ${label.toLowerCase()}...`}
                inputMode={isNumeric ? "numeric" : "text"}
            />
            {fieldData.is_manual && (
                <p className="text-[9px] text-indigo-500 font-black uppercase tracking-tighter px-1">
                    Modified Manually
                </p>
            )}
        </div>
    );
}
