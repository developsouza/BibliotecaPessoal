import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";

const PLAN_BADGES = {
    free: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
    premium: "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300",
    pro: "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300",
    master: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300",
};

function StatBox({ label, value, icon, color = "text-primary-600" }) {
    return (
        <div className="card p-4 text-center">
            <i className={`fa-solid ${icon} text-lg ${color} mb-1`} />
            <p className="text-2xl font-bold text-[--color-text]">{value}</p>
            <p className="text-xs text-[--color-muted]">{label}</p>
        </div>
    );
}

export default function AdminTenantDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editName, setEditName] = useState(false);
    const [nameVal, setNameVal] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get(`/admin/tenants/${id}`)
            .then((r) => {
                setData(r.data);
                setNameVal(r.data.tenant?.name || "");
            })
            .catch((err) => setError(err.response?.data?.error || "Não encontrado"))
            .finally(() => setLoading(false));
    }, [id]);

    const saveName = async () => {
        if (!nameVal.trim()) return;
        setSaving(true);
        await api.put(`/admin/tenants/${id}`, { name: nameVal });
        setData((prev) => ({ ...prev, tenant: { ...prev.tenant, name: nameVal } }));
        setEditName(false);
        setSaving(false);
    };

    const toggleActive = async () => {
        const action = tenant.is_active ? "desativar" : "ativar";
        if (!confirm(`Deseja ${action} o tenant "${tenant.name}"?`)) return;
        try {
            const { data: res } = await api.patch(`/admin/tenants/${id}/toggle-active`);
            setData((prev) => ({ ...prev, tenant: { ...prev.tenant, is_active: res.isActive ? 1 : 0 } }));
        } catch (err) {
            alert(err.response?.data?.error || `Erro ao ${action} tenant`);
        }
    };

    const handleDelete = async () => {
        const confirmed = confirm(
            `Deletar permanentemente o tenant "${tenant.name}"?\n\nESTA AÇÃO É IRREVERSÍVEL e removerá todos os dados (livros, usuários, leituras, emprestimos, gamificação, etc.).`,
        );
        if (!confirmed) return;
        try {
            await api.delete(`/admin/tenants/${id}`);
            navigate("/admin/tenants");
        } catch (err) {
            alert(err.response?.data?.error || "Erro ao deletar tenant");
        }
    };

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
                <Link to="/admin/tenants" className="btn-secondary mt-4 inline-flex">
                    Voltar
                </Link>
            </div>
        );

    const { tenant, stats, users = [], subscription, payments = [] } = data;

    return (
        <div className="space-y-6">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Link to="/admin/tenants" className="text-[--color-muted] hover:text-[--color-text]">
                        <i className="fa-solid fa-arrow-left" />
                    </Link>
                    {editName ? (
                        <div className="flex items-center gap-2">
                            <input value={nameVal} onChange={(e) => setNameVal(e.target.value)} className="input text-xl font-bold" />
                            <button onClick={saveName} disabled={saving} className="btn-primary text-sm py-1 px-3">
                                {saving ? "..." : "Salvar"}
                            </button>
                            <button onClick={() => setEditName(false)} className="btn-secondary text-sm py-1 px-3">
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-[--color-text]">{tenant.name}</h1>
                            <button onClick={() => setEditName(true)} className="text-[--color-muted] hover:text-[--color-text]" title="Editar nome">
                                <i className="fa-solid fa-pen text-sm" />
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${PLAN_BADGES[tenant.plan] || ""}`}>{tenant.plan}</span>
                    <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${tenant.is_active ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}
                    >
                        {tenant.is_active ? "Ativo" : "Inativo"}
                    </span>
                    <Link to={`/admin/tenants/${id}/edit`} className="btn-secondary text-sm">
                        <i className="fa-solid fa-pen mr-1" /> Editar
                    </Link>
                    {tenant.plan !== "master" && (
                        <button
                            onClick={toggleActive}
                            className={`btn-secondary text-sm ${
                                tenant.is_active
                                    ? "text-orange-600 border-orange-200 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                    : "text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                            }`}
                        >
                            <i className={`fa-solid mr-1 ${tenant.is_active ? "fa-ban" : "fa-circle-check"}`} />
                            {tenant.is_active ? "Desativar" : "Ativar"}
                        </button>
                    )}
                    {tenant.plan !== "master" && (
                        <button
                            onClick={handleDelete}
                            className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                            <i className="fa-solid fa-trash mr-1" /> Deletar
                        </button>
                    )}
                </div>
            </div>

            {/* Info + Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="card p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-[--color-muted] uppercase tracking-wide">Informações</h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-[--color-muted]">ID</span>
                            <span className="text-[--color-text] font-mono text-xs truncate max-w-[160px]">{tenant.id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[--color-muted]">Owner</span>
                            <span className="text-[--color-text]">{tenant.owner_name || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[--color-muted]">Email</span>
                            <span className="text-[--color-text]">{tenant.owner_email || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[--color-muted]">Criado em</span>
                            <span className="text-[--color-text]">{tenant.created_at?.slice(0, 10) || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[--color-muted]">Máx. Livros</span>
                            <span className="text-[--color-text]">{tenant.max_books === 99999 ? "∞" : tenant.max_books}</span>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatBox label="Livros" value={stats?.books || 0} icon="fa-books" color="text-primary-600" />
                    <StatBox label="Usuários" value={stats?.users || 0} icon="fa-users" color="text-blue-600" />
                    <StatBox label="Leituras" value={stats?.readings || 0} icon="fa-book-open" color="text-green-600" />
                    <StatBox label="Empréstimos" value={stats?.loans || 0} icon="fa-book-arrow-right" color="text-orange-600" />
                </div>
            </div>

            {/* Usuários */}
            <div className="card p-6">
                <h2 className="text-base font-semibold text-[--color-text] mb-4">Usuários do Tenant</h2>
                {users.length === 0 ? (
                    <p className="text-center py-6 text-[--color-muted]">Nenhum usuário encontrado.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[--color-border]">
                                    <th className="text-left pb-2 font-medium text-[--color-muted]">Nome</th>
                                    <th className="text-left pb-2 font-medium text-[--color-muted]">Email</th>
                                    <th className="text-center pb-2 font-medium text-[--color-muted]">Status</th>
                                    <th className="text-center pb-2 font-medium text-[--color-muted]">Criado</th>
                                    <th className="text-center pb-2 font-medium text-[--color-muted]">Último Login</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id} className="border-b border-[--color-border] last:border-0">
                                        <td className="py-2 text-[--color-text]">{u.full_name || "—"}</td>
                                        <td className="py-2 text-[--color-muted]">{u.email}</td>
                                        <td className="py-2 text-center">
                                            <span
                                                className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}
                                            >
                                                {u.is_active ? "Ativo" : "Inativo"}
                                            </span>
                                        </td>
                                        <td className="py-2 text-center text-[--color-muted]">{u.created_at?.slice(0, 10) || "—"}</td>
                                        <td className="py-2 text-center text-[--color-muted]">{u.last_login_at?.slice(0, 10) || "Nunca"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Plano Atual */}
            <div className="card p-6">
                <h2 className="text-base font-semibold text-[--color-text] mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-credit-card text-primary-500" /> Plano &amp; Assinatura
                </h2>
                {!subscription ? (
                    <p className="text-sm text-[--color-muted]">Nenhuma assinatura registrada para este tenant.</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-[--color-muted] text-xs mb-0.5">Plano</p>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${PLAN_BADGES[subscription.plan] || ""}`}>
                                {subscription.plan}
                            </span>
                        </div>
                        <div>
                            <p className="text-[--color-muted] text-xs mb-0.5">Status</p>
                            <span
                                className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    subscription.status === "active" || subscription.status === "trial"
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                        : subscription.status === "cancelled" || subscription.status === "ended"
                                          ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                          : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                }`}
                            >
                                {subscription.status}
                            </span>
                        </div>
                        <div>
                            <p className="text-[--color-muted] text-xs mb-0.5">Período atual</p>
                            <p className="text-[--color-text]">
                                {subscription.currentPeriodStart?.slice(0, 10) || "—"} → {subscription.currentPeriodEnd?.slice(0, 10) || "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-[--color-muted] text-xs mb-0.5">Valor mensal</p>
                            <p className="text-[--color-text]">
                                {subscription.monthlyAmount != null
                                    ? `${(subscription.monthlyAmount / 100).toLocaleString("pt-BR", { style: "currency", currency: subscription.currency?.toUpperCase() || "BRL" })}`
                                    : "—"}
                            </p>
                        </div>
                        {subscription.cancelAtPeriodEnd && (
                            <div className="col-span-2 sm:col-span-4">
                                <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full">
                                    <i className="fa-solid fa-triangle-exclamation mr-1" />
                                    Cancelamento agendado ao fim do período
                                </span>
                            </div>
                        )}
                        {subscription.trialEnd && (
                            <div className="col-span-2 sm:col-span-4">
                                <p className="text-xs text-[--color-muted]">
                                    Trial até: <span className="text-[--color-text]">{subscription.trialEnd.slice(0, 10)}</span>
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Histórico de Pagamentos */}
            <div className="card p-6">
                <h2 className="text-base font-semibold text-[--color-text] mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-receipt text-green-500" /> Histórico de Pagamentos
                </h2>
                {payments.length === 0 ? (
                    <p className="text-center py-6 text-[--color-muted] text-sm">Nenhum pagamento registrado.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[--color-border]">
                                    <th className="text-left pb-2 font-medium text-[--color-muted]">Descrição</th>
                                    <th className="text-center pb-2 font-medium text-[--color-muted]">Valor</th>
                                    <th className="text-center pb-2 font-medium text-[--color-muted]">Status</th>
                                    <th className="text-center pb-2 font-medium text-[--color-muted]">Data</th>
                                    <th className="text-center pb-2 font-medium text-[--color-muted]">Fatura</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p) => (
                                    <tr key={p.id} className="border-b border-[--color-border] last:border-0">
                                        <td className="py-2 text-[--color-text]">{p.description || "—"}</td>
                                        <td className="py-2 text-center text-[--color-text]">
                                            {p.amount != null
                                                ? (p.amount / 100).toLocaleString("pt-BR", {
                                                      style: "currency",
                                                      currency: p.currency?.toUpperCase() || "BRL",
                                                  })
                                                : "—"}
                                        </td>
                                        <td className="py-2 text-center">
                                            <span
                                                className={`text-xs px-2 py-0.5 rounded-full ${
                                                    p.status === "paid" || p.status === "succeeded"
                                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                                        : p.status === "failed"
                                                          ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                                          : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                                }`}
                                            >
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="py-2 text-center text-[--color-muted]">{(p.paidAt || p.createdAt)?.slice(0, 10) || "—"}</td>
                                        <td className="py-2 text-center">
                                            {p.invoicePdfUrl ? (
                                                <a
                                                    href={p.invoicePdfUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary-600 hover:underline text-xs"
                                                >
                                                    <i className="fa-solid fa-file-pdf mr-1" />
                                                    PDF
                                                </a>
                                            ) : p.invoiceUrl ? (
                                                <a
                                                    href={p.invoiceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary-600 hover:underline text-xs"
                                                >
                                                    <i className="fa-solid fa-external-link mr-1" />
                                                    Ver
                                                </a>
                                            ) : (
                                                <span className="text-[--color-muted]">—</span>
                                            )}
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
