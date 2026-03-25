"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { setAccessToken, apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { User } from "@omr-prod/contracts";

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (email: string, pass: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function restore() {
            try {
                // Check if session is alive
                const data = await apiFetch<User>("/api/v1/auth/me");
                setUser(data);
            } catch {
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        }
        restore();
    }, []);

    const login = async (email: string, pass: string) => {
        const data = await apiFetch<{ accessToken: string; user: User }>("/api/v1/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password: pass }),
        });
        setAccessToken(data.accessToken);
        setUser(data.user);
        router.push("/dashboard");
    };

    const logout = async () => {
        try {
            await apiFetch("/api/v1/auth/logout", { method: "POST" });
        } catch {}
        setAccessToken(null);
        setUser(null);
        router.push("/");
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
