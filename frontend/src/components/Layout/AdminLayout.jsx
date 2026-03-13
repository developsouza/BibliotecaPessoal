import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function AdminLayout() {
    const { user, loading } = useAuth();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (!user.isMasterAdmin) return <Navigate to="/" replace />;

    return (
        <div className="flex h-screen overflow-hidden bg-[--color-bg]">
            <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <Navbar onMenuClick={() => setMobileNavOpen(true)} />
                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="mb-4 flex items-center gap-2 text-purple-600 dark:text-purple-400">
                        <i className="fa-solid fa-shield-halved" />
                        <span className="text-sm font-semibold">Painel de Administração</span>
                    </div>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
