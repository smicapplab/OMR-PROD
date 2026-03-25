export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userType: 'SUPER_ADMIN' | 'NATIONAL_AUDITOR' | 'SCHOOL_ADMIN' | 'EDGE_OPERATOR' | 'DEPED_MONITOR';
    isActive: boolean;
    schoolId?: string;
    visibilityScope: 'NATIONAL' | 'REGIONAL' | 'DIVISION' | 'SCHOOL';
    scopeValue?: string;
}

export interface LoginResponse {
    accessToken: string;
    user: User;
}

export interface Scan {
    id: number;
    fileName: string;
    filePath?: string;
    originalSha: string;
    syncStatus: 'pending' | 'synced' | 'error';
    processStatus: 'pending' | 'success' | 'error' | 'pending_approval';
    confidence: number;
    reviewRequired: boolean;
    isManuallyEdited: boolean;
    rawData: any; // We'll keep any for the complex nested OMR object for now
    studentName?: string;
    imageUrl?: string;
    createdAt: string;
    updatedAt: string;
    schoolId?: string;
    machineId?: string;
}

export interface AuditLog {
    id: string | number;
    scanId: string | number;
    action: string;
    operator?: string;
    userName?: string;
    userEmail?: string;
    fileName?: string;
    reason?: string;
    status?: string;
    statusBefore?: string;
    statusAfter?: string;
    details: {
        old_data: any;
        new_data: any;
    };
    createdAt: string;
}

export interface CloudScan {
    id: string;
    schoolId: string;
    schoolName?: string;
    machineId: string;
    fileName: string;
    totalScore: number;
    maxScore: number;
    confidence: number;
    status: string;
    createdAt: string;
    reviewRequired: boolean;
    studentName?: string;
    lrn?: string;
    extracted_data?: any;
    pending_data?: any;
    gradingDetails?: any;
    fileUrl?: string;
}

export * from './omr';
