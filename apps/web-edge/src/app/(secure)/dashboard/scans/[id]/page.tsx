/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface ScanDetail {
    id: number;
    file_name: string;
    original_sha: string;
    image_url: string;
    process_status: string;
    sync_status: string;
    confidence: number;
    review_required: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw_data: any;
    created_at: string;
}

export default function ScanDetailPage() {
    const params = useParams();
    const [scan, setScan] = useState<ScanDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    useEffect(() => {
        async function loadScan() {
            try {
                const data = await apiFetch<ScanDetail>(`/api/v1/scans/${params.id}`);
                setScan(data);
            } catch (err) {
                console.error("Failed to load scan", err);
            } finally {
                setIsLoading(false);
            }
        }
        loadScan();
    }, [params.id]);

    if (isLoading) return <div className="p-10">Loading scan details...</div>;
    if (!scan) return <div className="p-10">Scan not found.</div>;

    const studentInfo = scan.raw_data?.student_info || {};
    const answers = scan.raw_data?.answers || {};

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-sm">
                <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
                    <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-500 ">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-lg font-bold">Scan Quality Review</h1>
                    <div className="w-20"></div>
                </div>
            </nav>

            <div className="flex h-[calc(100vh-64px)] overflow-hidden">
                {/* Left: Image Viewer */}
                <div className="flex-1 bg-gray-900 p-4 flex items-center justify-center overflow-auto">
                    <img 
                        src={`${API_URL}${scan.image_url}`} 
                        alt="Scanned Sheet" 
                        className="max-h-full max-w-full shadow-2xl"
                    />
                </div>

                {/* Right: Data Review (No Scores shown) */}
                <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto p-6">
                    <div className="mb-8">
                        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Extraction Status</h2>
                        <div className="flex gap-2">
                            <span className={`px-2 py-1 rounded text-xs ${scan.review_required ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                {scan.review_required ? 'Review Required' : 'Auto-Verified'}
                            </span>
                            <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800 uppercase">
                                {scan.process_status}
                            </span>
                        </div>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Student Information</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400">Full Name</label>
                                <p className="">
                                    {studentInfo.first_name?.answer || '---'} {studentInfo.last_name?.answer || '---'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400">LRN (Student ID)</label>
                                <p className="tracking-widest">{studentInfo.lrn?.answer || '---'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Exam Completion</h2>
                        <div className="space-y-2">
                            {Object.keys(answers).map(subject => (
                                <div key={subject} className="flex justify-between items-center py-2 border-b border-gray-50">
                                    <span className="capitalize text-sm ">{subject}</span>
                                    <span className="text-xs text-green-600 ">Processed</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto pt-10 text-xs text-gray-400">
                        <p>Machine: DEV-MACHINE-001</p>
                        <p>Integrity Hash: {scan.original_sha.substring(0, 16)}...</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
