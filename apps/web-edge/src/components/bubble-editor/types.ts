import { Scan } from "@omr-prod/contracts";

export interface OMRScore {
    [choice: string]: number;
}

export interface OMRDetailColumn {
    selected: string | null;
    confidence: number;
    status: string;
    scores: OMRScore;
}

export interface OMRFieldDetails {
    [colIdx: string]: OMRDetailColumn;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    digits?: any; // Fallback for nested digits structure
}

export interface OMRField {
    answer: string | string[];
    confidence: number;
    review_required: boolean;
    details: OMRFieldDetails;
    is_manual?: boolean;
}

export interface AnswerData {
    answer: string | null;
    confidence: number;
    review_required: boolean;
    scores: OMRScore;
    is_manual?: boolean;
}

export interface OMRRawData {
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

export interface BubbleEditorProps {
    scan: Scan;
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    saveEndpoint?: string;
}
