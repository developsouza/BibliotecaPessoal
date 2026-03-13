import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import api from "../../api/axios";

const PLAN_COLORS = { free: "#94a3b8", premium: "#6366f1", pro: "#8b5cf6", master: "#f59e0b" };
const PLAN_BADGES = {
    free: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
    premium: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
    pro: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
    master: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
};

function MetricCard({ icon, label, value, color = "text-primary-600", sub, to }) {
    const inner = (
        <div className={`card p-5 flex items-center gap-4 ${to ? "hover:border-primary-400 transition-colors cursor-pointer" : ""}`}>
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                <i className={`fa-solid ${icon} text-lg ${color}`} />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-bold text-[--color-text] leading-tight">{value}</p>
                <p className="text-xs text-[--color-muted] truncate">{label}</p>
                {sub && <p className="text-xs text-[--color-muted] mt-0.5">{sub}</p>}
            </div>
        </div>
    );
    return to ? <Link to={to}>{inner}</Link> : inner;
}

function SectionTitle({ icon, children }) {
    return (
        <h2 className="text-sm font-semibold text-[--color-muted] uppercase tracking-wide flex items-center gap-2 mb-4">
            <i className={`fa-solid ${icon}`} /> {children}
        </h2>
    );
}

function fmt(cents) {
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminDashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("/admin/dashboard")
            .then((r) => setData(r.data))
            .catch((err) => setError(err.response?.data?.error || "Acesso negado"))
            .finally(() => setLoading(false));
    }, []);

    if (loading)
        return (
            <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );

    if (error)
        return (
            <div className="card p-8 text-center">
                <i className="fa-solid fa-lock text-4xl text-slate-300 mb-3" />
                <p className="text-[--color-muted]">{error}</p>
            </div>
        );

    const {
        totals = {},
        subscriptionStats = {},
        revenue = {},
        planDistribution = [],
        monthlyGrowth = [],
        monthlyRevenue = [],
        recentTenants = [],
    } = data || {};

    const growthData = monthlyGrowth.map((g) => ({ name: g.month?.slice(5) || g.month, tenants: g.new_tenants }));
    const revenueData = monthlyRevenue.map((r) => ({ name: r.month?.slice(5) || r.month, receita: r.revenue / 100 }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-[--color-text]">Admin Dashboard</h1>
                    <p className="text-sm text-[--color-muted] mt-0.5">Visão geral do SaaS</p>
                </div>
                <Link to="/admin/tenants/new" className="btn-primary text-sm">
                    <i className="fa-solid fa-plus mr-2" />
                    Novo Tenant
                </Link>
            </div>

            {/* Métricas gerais */}
            <div>
                <SectionTitle icon="fa-chart-line">Plataforma</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <MetricCard
                        icon="fa-building"
                        label="Tenants Ativos"
                        value={totals.totalTenants ?? 0}
                        color="text-primary-600"
                        to="/admin/tenants"
                    />
                    <MetricCard icon="fa-users" label="Usuários" value={totals.totalUsers ?? 0} color="text-blue-600" />
                    <MetricCard icon="fa-books" label="Livros" value={totals.totalBooks ?? 0} color="text-green-600" />
                    <MetricCard icon="fa-book-arrow-right" label="Empréstimos" value={totals.totalLoans ?? 0} color="text-orange-600" />
                    <MetricCard icon="fa-clock" label="Em Aberto" value={totals.activeLoans ?? 0} color="text-red-500" sub="não devolvidos" />
                    <MetricCard icon="fa-circle-check" label="Leituras Concluídas" value={totals.totalReadings ?? 0} color="text-emerald-600" />
                </div>
            </div>

            {/* Métricas de assinatura + receita */}
            <div>
                <SectionTitle icon="fa-credit-card">Assinaturas &amp; Receita</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <MetricCard icon="fa-circle-check" label="Ativas" value={subscriptionStats.activeSubscriptions ?? 0} color="text-green-600" />
                    <MetricCard icon="fa-hourglass-half" label="Em Trial" value={subscriptionStats.trialSubscriptions ?? 0} color="text-yellow-500" />
                    <MetricCard
                        icon="fa-circle-xmark"
                        label="Canceladas"
                        value={subscriptionStats.cancelledSubscriptions ?? 0}
                        color="text-red-500"
                    />
                    <MetricCard
                        icon="fa-triangle-exclamation"
                        label="Inadimplentes"
                        value={subscriptionStats.pastDueSubscriptions ?? 0}
                        color="text-orange-500"
                    />
                    <MetricCard icon="fa-coins" label="Receita no Mês" value={fmt(revenue.monthRevenue ?? 0)} color="text-primary-600" />
                    <MetricCard icon="fa-sack-dollar" label="Receita Total" value={fmt(revenue.totalRevenue ?? 0)} color="text-violet-600" />
                </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Crescimento mensal */}
                <div className="card p-6">
                    <SectionTitle icon="fa-chart-bar">Novos Tenants (6 meses)</SectionTitle>
                    {growthData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={growthData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={24} />
                                <Tooltip
                                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                                />
                                <Bar dataKey="tenants" name="Tenants" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-center py-10 text-[--color-muted] text-sm">Sem dados ainda.</p>
                    )}
                </div>

                {/* Receita mensal */}
                <div className="card p-6">
                    <SectionTitle icon="fa-arrow-trend-up">Receita Mensal (6 meses)</SectionTitle>
                    {revenueData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={revenueData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
                                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={40} tickFormatter={(v) => `R$${v}`} />
                                <Tooltip
                                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                                    formatter={(v) => [`R$ ${v.toFixed(2)}`, "Receita"]}
                                />
                                <Line type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-center py-10 text-[--color-muted] text-sm">Sem pagamentos registrados ainda.</p>
                    )}
                </div>

                {/* Distribuição por plano */}
                <div className="card p-6">
                    <SectionTitle icon="fa-chart-pie">Distribuição por Plano</SectionTitle>
                    {planDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={planDistribution}
                                    dataKey="count"
                                    nameKey="plan"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={65}
                                    label={({ plan, percent }) => `${plan} ${(percent * 100).toFixed(0)}%`}
                                    labelLine={false}
                                >
                                    {planDistribution.map((p, i) => (
                                        <Cell key={i} fill={PLAN_COLORS[p.plan] || "#94a3b8"} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                                />
                                <Legend iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-center py-10 text-[--color-muted] text-sm">Sem dados de planos.</p>
                    )}
                </div>
            </div>

            {/* Tenants recentes */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <SectionTitle icon="fa-clock-rotate-left">Tenants Recentes</SectionTitle>
                    <Link to="/admin/tenants" className="text-xs text-primary-600 hover:underline">
                        Ver todos <i className="fa-solid fa-arrow-right ml-1" />
                    </Link>
                </div>
                {recentTenants.length === 0 ? (
                    <p className="text-center py-6 text-[--color-muted] text-sm">Nenhum tenant cadastrado ainda.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[--color-border]">
                                    <th className="text-left pb-2 font-medium text-[--color-muted]">Biblioteca</th>
                                    <th className="text-left pb-2 font-medium text-[--color-muted]">Proprietário</th>
                                    <th className="text-center pb-2 font-medium text-[--color-muted]">Plano</th>
                                    <th className="text-center pb-2 font-medium text-[--color-muted]">Status</th>
                                    <th className="text-center pb-2 font-medium text-[--color-muted]">Criado em</th>
                                    <th className="text-center pb-2 font-medium text-[--color-muted]"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentTenants.map((t) => (
                                    <tr
                                        key={t.id}
                                        className="border-b border-[--color-border] last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                    >
                                        <td className="py-2 text-[--color-text] font-medium">{t.name}</td>
                                        <td className="py-2 text-[--color-muted]">
                                            <div>{t.owner_name || "—"}</div>
                                            <div className="text-xs text-[--color-muted]">{t.owner_email || ""}</div>
                                        </td>
                                        <td className="py-2 text-center">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_BADGES[t.plan] || ""}`}>
                                                {t.plan}
                                            </span>
                                        </td>
                                        <td className="py-2 text-center">
                                            <span
                                                className={`text-xs px-2 py-0.5 rounded-full ${t.is_active ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400"}`}
                                            >
                                                {t.is_active ? "Ativo" : "Inativo"}
                                            </span>
                                        </td>
                                        <td className="py-2 text-center text-[--color-muted]">{t.created_at?.slice(0, 10) || "—"}</td>
                                        <td className="py-2 text-center">
                                            <Link to={`/admin/tenants/${t.id}`} className="text-primary-600 hover:underline text-xs">
                                                Ver <i className="fa-solid fa-arrow-right ml-0.5" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
