import { OMRField } from "./types";
import { Select } from "@/components/ui/select";

interface CategoricalSelectProps {
    label: string;
    path: string[];
    fieldData: OMRField;
    onUpdate: (path: string[], val: string) => void;
    options?: string[];
}

export function CategoricalSelect({ label, path, fieldData, onUpdate, options: optionsOverride }: CategoricalSelectProps) {
    if (!fieldData || (!fieldData.details && !optionsOverride)) return null;

    const columnZero = fieldData.details?.["0"] || (fieldData.details ? Object.values(fieldData.details)[0] : null);
    const options = optionsOverride || Object.keys(columnZero?.scores || {});

    if (options.length === 0) return null;

    return (
        <div className="space-y-3">
            <label className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">{label}</label>
            <Select
                value={fieldData.answer as string}
                onValueChange={(val) => onUpdate(path, val)}
                options={options}
                placeholder={`${label.toLowerCase().replace("birth ", "")}...`}
            />
        </div>
    );
}
