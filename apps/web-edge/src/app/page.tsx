"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login, user, isLoading } = useAuth();
    const router = useRouter();

    // Redirect if already logged in
    useEffect(() => {
        if (!isLoading && user) {
            router.push("/dashboard");
        }
    }, [user, isLoading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);
        try {
            await login(email, password);
        } catch (err) {
            setError("Authentication failed. Please verify your credentials.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50 font-sans">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-600 animate-pulse shadow-lg shadow-indigo-100" />
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Synchronizing Vault...</p>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 font-sans">
            <Card className="w-full max-w-md shadow-xl rounded-3xl border-none">
                <CardHeader className="space-y-4 text-center pt-10 pb-6">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-100">
                        <Monitor className="h-6 w-6 text-white" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black tracking-tight text-slate-900 uppercase">Edge Console</CardTitle>
                        <CardDescription className="text-slate-500 ">Local OMR Capture & Verification</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="px-10 pb-12">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-slate-400 ml-1">Operator Email</label>
                            <Input
                                type="email"
                                placeholder="operator@school.edu.ph"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-slate-400 ml-1">Security Key</label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {error && <p className="text-xs text-rose-500 text-center">{error}</p>}

                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-100"
                        >
                            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Identity"}
                        </Button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                        <p className="text-[10px] leading-relaxed text-slate-400 text-center uppercase tracking-wider">
                            <span className="text-slate-900 block mb-1">Security Warning</span>
                            This is a restricted governmental information system. Access is granted only to authorized personnel for official business purposes. Unauthorized access, attempt, or use is strictly prohibited and may be subject to criminal and/or civil penalties under applicable laws.
                        </p>
                        <p className="text-[9px] text-slate-400 text-center italic">
                            All activities on this system are monitored and recorded. By logging in, you acknowledge your understanding of these terms and consent to such monitoring.
                        </p>
                        <p className="text-[10px] text-slate-300 text-center uppercase tracking-widest pt-2">
                            Secure Access Monitoring Enabled
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
