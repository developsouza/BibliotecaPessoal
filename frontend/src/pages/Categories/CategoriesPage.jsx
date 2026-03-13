import { useState, useEffect } from "react";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";

const PRESET_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b", "#1e293b"];

const DEFAULTS = { name: "", color: "#3b82f6", icon: "fa-solid fa-tag" };

export default function CategoriesPage() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState(DEFAULTS);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [error, setError] = useState("");
    const { addToast } = useToast();

    const load = () => {
        setLoading(true);
        api.get("/categories")
            .then((r) => setCategories(r.data))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const openCreate = () => {
        setEditing(null);
        setForm(DEFAULTS);
        setError("");
        setModal(true);
    };
    const openEdit = (c) => {
        setEditing(c);
        setForm({ name: c.name, color: c.color || "#3b82f6", icon: c.icon || "fa-solid fa-tag" });
        setError("");
        setModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return setError("Nome é obrigatório");
        setSaving(true);
        setError("");
        try {
            if (editing) await api.put("/categories/" + editing.id, form);
            else await api.post("/categories", form);
            load();
            setModal(false);
        } catch (err) {
            setError(err.response?.data?.error || "Erro ao salvar");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        setDeleting(id);
        try {
            await api.delete("/categories/" + id);
            load();
        } catch {
            addToast("Erro ao excluir categoria.", "error");
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-[--color-text]">
                    <i className="fa-solid fa-tags text-primary-600 mr-2" />
                    Categorias
                </h1>
                <button onClick={openCreate} className="btn-primary">
                    <i className="fa-solid fa-plus" /> Nova categoria
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
            ) : categories.length === 0 ? (
                <div className="card p-12 text-center">
                    <i className="fa-solid fa-folder-open text-5xl text-[--color-muted] mb-3" />
                    <p className="text-[--color-muted]">Nenhuma categoria criada. Comece agora!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {categories.map((c) => (
                        <div key={c.id} className="card p-4 flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: c.color || "#3b82f6" }}
                            >
                                <i className={"text-white text-sm " + (c.icon || "fa-solid fa-tag")} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-[--color-text] truncate">{c.name}</p>
                                <p className="text-xs text-[--color-muted]">{c.bookCount ?? 0} livro(s)</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => openEdit(c)} className="btn-ghost p-1.5 text-[--color-muted] hover:text-primary-600">
                                    <i className="fa-solid fa-pen text-sm" />
                                </button>
                                <button
                                    onClick={() => handleDelete(c.id)}
                                    disabled={deleting === c.id}
                                    className="btn-ghost p-1.5 text-[--color-muted] hover:text-red-500"
                                >
                                    {deleting === c.id ? (
                                        <i className="fa-solid fa-spinner animate-spin text-sm" />
                                    ) : (
                                        <i className="fa-solid fa-trash text-sm" />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="card w-full max-w-md p-6 space-y-4">
                        <h2 className="text-lg font-bold text-[--color-text]">{editing ? "Editar categoria" : "Nova categoria"}</h2>

                        {error && <p className="text-sm text-red-500">{error}</p>}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">Nome *</label>
                                <input
                                    className="input"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="Ex: Literatura Brasileira"
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">Cor</label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {PRESET_COLORS.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, color: c }))}
                                            className={
                                                "w-7 h-7 rounded-full border-2 transition-transform " +
                                                (form.color === c ? "border-[--color-text] scale-110" : "border-transparent")
                                            }
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={form.color}
                                        onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                                        className="w-7 h-7 rounded border cursor-pointer"
                                        title="Cor personalizada"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Ícone (classe FontAwesome)</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        className="input flex-1"
                                        value={form.icon}
                                        onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                                        placeholder="fa-solid fa-tag"
                                    />
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: form.color }}
                                    >
                                        <i className={"text-white text-sm " + form.icon} />
                                    </div>
                                </div>
                                <p className="text-xs text-[--color-muted] mt-1">Ex: fa-solid fa-book | fa-solid fa-graduation-cap</p>
                            </div>

                            <div className="flex gap-3 justify-end pt-2">
                                <button type="button" onClick={() => setModal(false)} className="btn-secondary">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving} className="btn-primary">
                                    {saving ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-check" />}
                                    {editing ? "Salvar" : "Criar"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
