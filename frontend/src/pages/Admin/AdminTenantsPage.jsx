import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import Pagination from "../../components/UI/Pagination";

const PLAN_BADGES = {
    free: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
    premium: "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300",
    pro: "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300",
    master: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300",
};

const PLANS = ["free", "premium", "pro", "master"];
const PLAN_MAX = { free: 50, premium: 500, pro: 2000, master: 99999 };

function ChangePlanModal({ tenant, onSave, onClose }) {
    const [plan, setPlan] = useState(tenant.plan);
    const [maxBooks, setMaxBooks] = useState(tenant.max_books || PLAN_MAX[tenant.plan]);

    const handlePlanChange = (p) => {
        setPlan(p);
        setMaxBooks(PLAN_MAX[p]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="card w-full max-w-sm p-6 space-y-4">
                <h3 className="text-lg font-bold text-[--color-text]">Alterar Plano</h3>
                <p className="text-sm text-[--color-muted]">{tenant.name}</p>
                <div>
                    <label className="block text-sm font-medium text-[--color-muted] mb-1">Plano</label>
                    <select value={plan} onChange={(e) => handlePlanChange(e.target.value)} className="input">
                        {PLANS.map((p) => (
                            <option key={p} value={p}>
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-[--color-muted] mb-1">Máx. Livros</label>
                    <input type="number" min={1} value={maxBooks} onChange={(e) => setMaxBooks(+e.target.value)} className="input" />
                </div>
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="btn-secondary text-sm">
                        Cancelar
                    </button>
                    <button onClick={() => onSave(tenant.id, plan, maxBooks)} className="btn-primary text-sm">
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminTenantsPage() {
    const [data, setData] = useState({ tenants: [], pagination: {} });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [planFilter, setPlanFilter] = useState("");
    const [error, setError] = useState("");
    const [changingPlan, setChangingPlan] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (search) params.set("search", search);
            if (planFilter) params.set("plan", planFilter);
            const { data: res } = await api.get("/admin/tenants?" + params);
            setData(res);
        } catch (err) {
            setError(err.response?.data?.error || "Acesso negado");
        } finally {
            setLoading(false);
        }
    }, [page, search, planFilter]);

    useEffect(() => {
        load();
    }, [load]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
    };

    const savePlan = async (id, plan, maxBooks) => {
        setActionLoading(id);
        await api.put(`/admin/tenants/${id}/plan`, { plan, maxBooks });
        setChangingPlan(null);
        setActionLoading(null);
        load();
    };

    const toggleActive = async (tenant) => {
        const action = tenant.is_active ? "Desativar" : "Ativar";
        if (!confirm(`${action} o tenant "${tenant.name}"?`)) return;
        setActionLoading(tenant.id);
        try {
            await api.patch(`/admin/tenants/${tenant.id}/toggle-active`);
            load();
        } catch (err) {
            alert(err.response?.data?.error || `Erro ao ${action.toLowerCase()} tenant`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (tenant) => {
        if (tenant.plan === "master") return;
        const confirmed = confirm(
            `Deletar permanentemente o tenant "${tenant.name}"?\n\nISTO É IRREVERSÍVEL e removerá todos os dados (livros, usuários, leituras, etc.).`,
        );
        if (!confirmed) return;
        setActionLoading(tenant.id);
        try {
            await api.delete(`/admin/tenants/${tenant.id}`);
            load();
        } catch (err) {
            alert(err.response?.data?.error || "Erro ao deletar tenant");
        } finally {
            setActionLoading(null);
        }
    };

    if (error)
        return (
            <div className="card p-8 text-center">
                <i className="fa-solid fa-lock text-4xl text-slate-300 mb-3" />
                <p className="text-[--color-muted]">{error}</p>
            </div>
        );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <i className="fa-solid fa-users text-primary-600 text-xl" />
                    <h1 className="text-2xl font-bold text-[--color-text]">Gerenciar Tenants</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/admin/tenants/new" className="btn-primary text-sm">
                        <i className="fa-solid fa-plus mr-2" />
                        Criar Tenant
                    </Link>
                    <Link to="/admin" className="btn-secondary text-sm">
                        <i className="fa-solid fa-arrow-left mr-2" />
                        Dashboard
                    </Link>
                </div>
            </div>

            {/* Filtros */}
            <div className="card p-4 flex flex-wrap gap-3 items-end">
                <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input flex-1 text-sm"
                    />
                    <button type="submit" className="btn-primary text-sm px-4">
                        <i className="fa-solid fa-search" />
                    </button>
                </form>
                <select
                    value={planFilter}
                    onChange={(e) => {
                        setPlanFilter(e.target.value);
                        setPage(1);
                    }}
                    className="input text-sm w-auto"
                >
                    <option value="">Todos os planos</option>
                    {PLANS.map((p) => (
                        <option key={p} value={p}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {/* Tabela */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[--color-border] bg-slate-50 dark:bg-slate-800/50">
                                <th className="text-left px-4 py-3 font-medium text-[--color-muted]">Tenant</th>
                                <th className="text-left px-4 py-3 font-medium text-[--color-muted]">Owner</th>
                                <th className="text-center px-4 py-3 font-medium text-[--color-muted]">Plano</th>
                                <th className="text-center px-4 py-3 font-medium text-[--color-muted]">Livros</th>
                                <th className="text-center px-4 py-3 font-medium text-[--color-muted]">Status</th>
                                <th className="text-right px-4 py-3 font-medium text-[--color-muted]">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-[--color-muted]">
                                        <div className="inline-flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />{" "}
                                            Carregando...
                                        </div>
                                    </td>
                                </tr>
                            ) : data.tenants.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-[--color-muted]">
                                        Nenhum tenant encontrado.
                                    </td>
                                </tr>
                            ) : (
                                data.tenants.map((t) => (
                                    <tr
                                        key={t.id}
                                        className="border-b border-[--color-border] last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-[--color-text]">{t.name}</p>
                                            <p className="text-xs text-[--color-muted]">{t.created_at?.slice(0, 10)}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-[--color-text]">{t.owner_name || "—"}</p>
                                            <p className="text-xs text-[--color-muted]">{t.owner_email || "—"}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_BADGES[t.plan] || ""}`}>
                                                {t.plan}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-[--color-muted]">
                                            {t.books_count} / {t.max_books === 99999 ? "∞" : t.max_books}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span
                                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}
                                            >
                                                {t.is_active ? "Ativo" : "Inativo"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link
                                                    to={`/admin/tenants/${t.id}`}
                                                    className="p-1.5 rounded text-[--color-muted] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                    title="Ver detalhes"
                                                >
                                                    <i className="fa-solid fa-eye text-xs" />
                                                </Link>
                                                <Link
                                                    to={`/admin/tenants/${t.id}/edit`}
                                                    className="p-1.5 rounded text-[--color-muted] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                    title="Editar"
                                                >
                                                    <i className="fa-solid fa-pen text-xs" />
                                                </Link>
                                                <button
                                                    onClick={() => setChangingPlan(t)}
                                                    className="p-1.5 rounded text-[--color-muted] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                    title="Alterar plano"
                                                    disabled={actionLoading === t.id}
                                                >
                                                    <i className="fa-solid fa-crown text-xs" />
                                                </button>
                                                {t.plan !== "master" && (
                                                    <button
                                                        onClick={() => toggleActive(t)}
                                                        className={`p-1.5 rounded transition-colors ${
                                                            t.is_active
                                                                ? "text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                                                : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                        }`}
                                                        title={t.is_active ? "Desativar" : "Ativar"}
                                                        disabled={actionLoading === t.id}
                                                    >
                                                        <i className={`fa-solid text-xs ${t.is_active ? "fa-ban" : "fa-circle-check"}`} />
                                                    </button>
                                                )}
                                                {t.plan !== "master" && (
                                                    <button
                                                        onClick={() => handleDelete(t)}
                                                        className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        title="Deletar permanentemente"
                                                        disabled={actionLoading === t.id}
                                                    >
                                                        <i className="fa-solid fa-trash text-xs" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {data.pagination?.pages > 1 && <Pagination page={page} totalPages={data.pagination.pages} onPageChange={setPage} />}

            {changingPlan && <ChangePlanModal tenant={changingPlan} onSave={savePlan} onClose={() => setChangingPlan(null)} />}
        </div>
    );
}
