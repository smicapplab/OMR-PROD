"use client";

import { useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useAuth();

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

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
            <Card className="w-full max-w-md shadow-xl rounded-3xl border-none">
                <CardHeader className="space-y-4 text-center pt-10 pb-6">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-100">
                        <ShieldCheck className="h-6 w-6 text-white" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black tracking-tight text-slate-900">National Portal</CardTitle>
                        <CardDescription className="text-slate-500 font-medium">Enterprise OMR Grading & Analytics</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="px-10 pb-12">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Work Email</label>
                            <Input
                                type="email"
                                placeholder="name@agency.gov.ph"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Security Key</label>
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

                        {error && <p className="text-xs font-bold text-rose-500 text-center">{error}</p>}

                        <Button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-indigo-100"
                        >
                            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Access Portal"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
