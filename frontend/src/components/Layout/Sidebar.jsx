import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";

// planBadge: null = sem restrição, "PREMIUM" = requer premium+, "PRO" = requer pro
const navItems = [
    { to: "/", icon: "fa-house", label: "Dashboard" },
    { to: "/books", icon: "fa-book", label: "Livros" },
    { to: "/shelf", icon: "fa-bookmark", label: "Estante" },
    { to: "/reading", icon: "fa-book-open", label: "Leituras" },
    { to: "/loans", icon: "fa-right-left", label: "Empréstimos" },
    { to: "/google-books", icon: "fa-magnifying-glass", label: "Google Books", planBadge: "PREMIUM", featureKey: "google-books" },
    { to: "/gamification", icon: "fa-trophy", label: "Conquistas" },
    { to: "/statistics", icon: "fa-chart-bar", label: "Estat\u00edsticas", planBadge: "PRO", featureKey: "statistics" },
];

const bottomItems = [
    { to: "/profile", icon: "fa-user", label: "Perfil", hideForMaster: true },
    { to: "/billing", icon: "fa-credit-card", label: "Plano", hideForMaster: true },
    { to: "/setup", icon: "fa-building", label: "Organização", ownerOnly: true, hideForMaster: true },
];

export default function Sidebar({ mobileOpen = false, onMobileClose }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

    // Fecha o drawer ao trocar de rota no mobile
    const handleLinkClick = () => {
        if (onMobileClose) onMobileClose();
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
        if (onMobileClose) onMobileClose();
    };

    const planColors = {
        free: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
        premium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
        pro: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
        master: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    };

    return (
        <>
            {/* Backdrop mobile */}
            <div
                className={`fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300 ${
                    mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
                onClick={onMobileClose}
            />

            <aside
                className={`
          fixed md:relative inset-y-0 left-0 z-50 md:z-auto
          flex flex-col border-r border-[--color-border]
          bg-[--color-surface] transition-all duration-300
          ${collapsed ? "w-16" : "w-64"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-5 border-b border-[--color-border]">
                    <span className="text-2xl flex-shrink-0">📚</span>
                    {!collapsed && (
                        <div className="overflow-hidden">
                            <h1 className="font-bold text-[--color-text] text-base leading-tight truncate" title={user?.tenantName || "BookLibrary"}>
                                {user?.tenantName || "BookLibrary"}
                            </h1>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${planColors[user?.plan] || planColors.free}`}>
                                {user?.plan?.toUpperCase() || "FREE"}
                            </span>
                        </div>
                    )}
                    {/* Botão fechar no mobile / colapsar no desktop */}
                    <button
                        onClick={() => {
                            if (window.innerWidth < 768 && onMobileClose) {
                                onMobileClose();
                            } else {
                                setCollapsed((c) => !c);
                            }
                        }}
                        className="ml-auto btn-ghost p-1.5 text-[--color-muted] rounded-lg"
                        title={collapsed ? "Expandir" : "Fechar"}
                    >
                        <i className={`fa-solid ${collapsed ? "fa-chevron-right" : "fa-chevron-left"} text-xs md:block`} />
                    </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
                    {/* Master Admin: exibe apenas o Painel Admin */}
                    {user?.isMasterAdmin ? (
                        <>
                            <NavLink
                                to="/admin"
                                end
                                onClick={handleLinkClick}
                                className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""} ${collapsed ? "justify-center" : ""}`}
                                title={collapsed ? "Dashboard" : undefined}
                            >
                                <i className="fa-solid fa-gauge w-4 text-center flex-shrink-0" />
                                {!collapsed && <span className="truncate">Dashboard</span>}
                            </NavLink>
                            <div className="mt-3 mb-1 px-3">
                                {!collapsed && <p className="text-[10px] uppercase tracking-widest text-[--color-muted] font-semibold">Tenants</p>}
                            </div>
                            <NavLink
                                to="/admin/tenants"
                                onClick={handleLinkClick}
                                className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""} ${collapsed ? "justify-center" : ""}`}
                                title={collapsed ? "Tenants" : undefined}
                            >
                                <i className="fa-solid fa-building w-4 text-center flex-shrink-0" />
                                {!collapsed && <span>Tenants</span>}
                            </NavLink>
                            <NavLink
                                to="/admin/tenants/new"
                                onClick={handleLinkClick}
                                className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""} ${collapsed ? "justify-center" : ""}`}
                                title={collapsed ? "Novo Tenant" : undefined}
                            >
                                <i className="fa-solid fa-plus w-4 text-center flex-shrink-0" />
                                {!collapsed && <span>Novo Tenant</span>}
                            </NavLink>
                        </>
                    ) : (
                        navItems.map((item) => {
                            const isLockedPremium = item.planBadge === "PREMIUM" && user?.plan === "free";
                            const isLockedPro = item.planBadge === "PRO" && (user?.plan === "free" || user?.plan === "premium");
                            const isLocked = isLockedPremium || isLockedPro;

                            const badgeClass =
                                item.planBadge === "PRO"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";

                            if (isLocked) {
                                return (
                                    <NavLink
                                        key={item.to}
                                        to={`/billing/upgrade${item.featureKey ? `?feature=${item.featureKey}` : ""}`}
                                        onClick={handleLinkClick}
                                        className={`sidebar-link relative opacity-60 ${collapsed ? "justify-center" : ""}`}
                                        title={collapsed ? `${item.label} — Plano ${item.planBadge}` : undefined}
                                    >
                                        <i className={`fa-solid ${item.icon} w-4 text-center flex-shrink-0`} />
                                        {!collapsed && (
                                            <>
                                                <span className="truncate flex-1">{item.label}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>{item.planBadge}</span>
                                            </>
                                        )}
                                        {collapsed && item.planBadge && (
                                            <span
                                                className={`absolute right-0.5 top-0.5 text-[8px] font-bold px-1 rounded leading-tight ${badgeClass}`}
                                                style={{ lineHeight: "1.2" }}
                                            >
                                                {item.planBadge === "PRO" ? "P" : "P+"}
                                            </span>
                                        )}
                                    </NavLink>
                                );
                            }
                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.to === "/"}
                                    onClick={handleLinkClick}
                                    className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""} ${collapsed ? "justify-center" : ""}`}
                                    title={collapsed ? item.label : undefined}
                                >
                                    <i className={`fa-solid ${item.icon} w-4 text-center flex-shrink-0`} />
                                    {!collapsed && <span className="truncate">{item.label}</span>}
                                </NavLink>
                            );
                        })
                    )}
                </nav>

                {/* Bottom */}
                <div className="px-2 py-3 border-t border-[--color-border] space-y-0.5">
                    {bottomItems
                        .filter((item) => {
                            if (item.hideForMaster && user?.isMasterAdmin) return false;
                            if (item.ownerOnly && !user?.isOwner) return false;
                            return true;
                        })
                        .map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={handleLinkClick}
                                className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""} ${collapsed ? "justify-center" : ""}`}
                                title={collapsed ? item.label : undefined}
                            >
                                <i className={`fa-solid ${item.icon} w-4 text-center flex-shrink-0`} />
                                {!collapsed && <span>{item.label}</span>}
                            </NavLink>
                        ))}
                    <button
                        onClick={handleLogout}
                        className={`sidebar-link w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 ${collapsed ? "justify-center" : ""}`}
                        title={collapsed ? "Sair" : undefined}
                    >
                        <i className="fa-solid fa-right-from-bracket w-4 text-center flex-shrink-0" />
                        {!collapsed && <span>Sair</span>}
                    </button>
                </div>
            </aside>
        </>
    );
}
