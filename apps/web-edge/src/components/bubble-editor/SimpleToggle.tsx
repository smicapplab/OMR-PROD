import { OMRField } from "./types";
import { Switch } from "@/components/ui/switch";

interface SimpleToggleProps {
    label: string;
    path: string[];
    fieldData: OMRField;
    onUpdate: (path: string[], nextVal: string) => void;
}

export function SimpleToggle({ label, path, fieldData, onUpdate }: SimpleToggleProps) {
    if (!fieldData) return null;
    const isActive = fieldData.answer === "SELECTED" || fieldData.answer === "Yes";

    return (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-white hover:border-indigo-100 group">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-indigo-500 transition-colors">{label}</label>
            <div className="space-y-0.5 flex  items-center gap-3">
                <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => onUpdate(path, checked ? "Yes" : "No")}
                />

                <p className="text-[10px] font-bold text-slate-500 uppercase">{isActive ? "Enabled" : "Disabled"}</p>
            </div>
        </div>
    );
}
