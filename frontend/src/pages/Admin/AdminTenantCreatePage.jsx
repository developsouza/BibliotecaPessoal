import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";

const PLAN_DEFAULTS = {
    free: { maxBooks: 50, maxStorageMB: 50 },
    premium: { maxBooks: 500, maxStorageMB: 500 },
    pro: { maxBooks: 2000, maxStorageMB: 5120 },
    master: { maxBooks: 99999, maxStorageMB: 99999 },
};

const PLAN_INFO = [
    { key: "free", label: "Free", desc: "50 livros · 50 MB", color: "text-slate-600 dark:text-slate-400" },
    { key: "premium", label: "Premium", desc: "500 livros · 500 MB", color: "text-primary-600" },
    { key: "pro", label: "Pro", desc: "Ilimitado · 5 GB", color: "text-violet-600" },
    { key: "master", label: "Master Admin", desc: "Acesso administrativo", color: "text-yellow-600" },
];

export default function AdminTenantCreatePage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const [form, setForm] = useState({
        name: "",
        plan: "free",
        isActive: true,
        maxBooks: 50,
        maxStorageMB: 50,
        expiresAt: "",
    });

    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

    const handlePlanChange = (plan) => {
        const defaults = PLAN_DEFAULTS[plan];
        setForm((prev) => ({
            ...prev,
            plan,
            maxBooks: defaults.maxBooks,
            maxStorageMB: defaults.maxStorageMB,
        }));
    };

    const validate = () => {
        const errs = {};
        if (!form.name.trim()) errs.name = "Nome é obrigatório";
        else if (form.name.trim().length > 200) errs.name = "Máximo 200 caracteres";
        if (!form.plan) errs.plan = "Plano é obrigatório";
        if (!form.maxBooks || form.maxBooks < 1) errs.maxBooks = "Deve ser maior que 0";
        if (!form.maxStorageMB || form.maxStorageMB < 1) errs.maxStorageMB = "Deve ser maior que 0";
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) {
            setErrors(errs);
            return;
        }
        setLoading(true);
        try {
            const payload = {
                name: form.name.trim(),
                plan: form.plan,
                isActive: form.isActive,
                maxBooks: parseInt(form.maxBooks),
                maxStorageMB: parseInt(form.maxStorageMB),
                expiresAt: form.expiresAt || null,
            };
            const { data } = await api.post("/admin/tenants", payload);
            navigate(`/admin/tenants/${data.id}`);
        } catch (err) {
            const serverErrors = err.response?.data?.errors;
            if (serverErrors) setErrors(serverErrors);
            else setErrors({ _global: err.response?.data?.error || "Erro ao criar tenant" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Cabeçalho */}
            <div className="flex items-center gap-3">
                <Link to="/admin/tenants" className="text-[--color-muted] hover:text-[--color-text]">
                    <i className="fa-solid fa-arrow-left" />
                </Link>
                <i className="fa-solid fa-plus-circle text-primary-600 text-xl" />
                <h1 className="text-2xl font-bold text-[--color-text]">Criar Novo Tenant</h1>
            </div>

            {errors._global && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    <i className="fa-solid fa-circle-exclamation mr-2" />
                    {errors._global}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Formulário */}
                <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
                    {/* Nome */}
                    <div className="card p-6 space-y-4">
                        <h2 className="text-base font-semibold text-[--color-text]">Informações Básicas</h2>

                        <div>
                            <label className="block text-sm font-medium text-[--color-muted] mb-1">
                                Nome da Biblioteca <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setField("name", e.target.value)}
                                maxLength={200}
                                placeholder="Ex: Biblioteca do João"
                                className={`input w-full ${errors.name ? "border-red-400 focus:ring-red-400" : ""}`}
                            />
                            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                        </div>

                        {/* Plano */}
                        <div>
                            <label className="block text-sm font-medium text-[--color-muted] mb-2">
                                Plano <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {["free", "premium", "pro", "master"].map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => handlePlanChange(p)}
                                        className={`text-sm font-medium py-2 px-3 rounded-lg border-2 transition-colors ${
                                            form.plan === p
                                                ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                                                : "border-[--color-border] text-[--color-muted] hover:border-primary-300"
                                        }`}
                                    >
                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </button>
                                ))}
                            </div>
                            {errors.plan && <p className="text-xs text-red-500 mt-1">{errors.plan}</p>}
                        </div>
                    </div>

                    {/* Limites */}
                    <div className="card p-6 space-y-4">
                        <h2 className="text-base font-semibold text-[--color-text]">Limites</h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[--color-muted] mb-1">
                                    Máximo de Livros <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={form.maxBooks}
                                    onChange={(e) => setField("maxBooks", +e.target.value)}
                                    className={`input w-full ${errors.maxBooks ? "border-red-400" : ""}`}
                                />
                                {errors.maxBooks && <p className="text-xs text-red-500 mt-1">{errors.maxBooks}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[--color-muted] mb-1">
                                    Armazenamento (MB) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={form.maxStorageMB}
                                    onChange={(e) => setField("maxStorageMB", +e.target.value)}
                                    className={`input w-full ${errors.maxStorageMB ? "border-red-400" : ""}`}
                                />
                                {errors.maxStorageMB && <p className="text-xs text-red-500 mt-1">{errors.maxStorageMB}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Config extra */}
                    <div className="card p-6 space-y-4">
                        <h2 className="text-base font-semibold text-[--color-text]">Configurações Adicionais</h2>

                        <div>
                            <label className="block text-sm font-medium text-[--color-muted] mb-1">Data de Expiração (opcional)</label>
                            <input
                                type="datetime-local"
                                value={form.expiresAt}
                                onChange={(e) => setField("expiresAt", e.target.value)}
                                className="input w-full"
                            />
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={form.isActive}
                                    onChange={(e) => setField("isActive", e.target.checked)}
                                />
                                <div
                                    className={`w-10 h-5 rounded-full transition-colors ${form.isActive ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-600"}`}
                                />
                                <div
                                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : ""}`}
                                />
                            </div>
                            <span className="text-sm text-[--color-text]">Tenant ativo desde a criação</span>
                        </label>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-3 justify-end">
                        <Link to="/admin/tenants" className="btn-secondary">
                            Cancelar
                        </Link>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-2" />
                                    Criando...
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-plus mr-2" />
                                    Criar Tenant
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Sidebar informativa */}
                <div className="space-y-4">
                    <div className="card p-5">
                        <h3 className="text-sm font-semibold text-[--color-text] mb-3">
                            <i className="fa-solid fa-circle-info mr-2 text-primary-500" />
                            Planos disponíveis
                        </h3>
                        <ul className="space-y-3">
                            {PLAN_INFO.map((p) => (
                                <li key={p.key} className="text-sm">
                                    <span className={`font-semibold ${p.color}`}>{p.label}:</span>
                                    <span className="text-[--color-muted] ml-1">{p.desc}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="card p-5 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                        <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">
                            <i className="fa-solid fa-triangle-exclamation mr-2" />
                            Atenção
                        </h3>
                        <p className="text-xs text-[--color-muted] leading-relaxed">
                            Tenants criados sem um usuário owner não terão acesso imediato. O proprietário deve ser associado via registro de usuário.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
