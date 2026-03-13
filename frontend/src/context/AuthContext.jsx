import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("bl-token");
        if (token) {
            api.get("/auth/me")
                .then((res) => setUser(res.data))
                .catch(() => localStorage.removeItem("bl-token"))
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        localStorage.setItem("bl-token", data.token);
        setUser(data.user);
        return data.user;
    };

    const register = async (email, password, fullName) => {
        const { data } = await api.post("/auth/register", { email, password, fullName });
        localStorage.setItem("bl-token", data.token);
        setUser(data.user);
        return data.user;
    };

    const logout = () => {
        localStorage.removeItem("bl-token");
        setUser(null);
    };

    const updateUser = (updates) => {
        setUser((prev) => ({ ...prev, ...updates }));
    };

    const updateToken = (newToken) => {
        localStorage.setItem("bl-token", newToken);
        // Atualizar plano imediatamente via decode do JWT (sem esperar request)
        try {
            const payload = JSON.parse(atob(newToken.split(".")[1]));
            if (payload.plan) {
                setUser((prev) => ({ ...prev, plan: payload.plan }));
            }
        } catch {}
        // Buscar dados completos e atualizados do servidor
        return api
            .get("/auth/me")
            .then((res) => setUser(res.data))
            .catch(() => {});
    };

    return <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, updateToken }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}

export default AuthContext;
