import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

const LANGUAGE_LIST = ["Português", "Inglês", "Espanhol", "Francês", "Alemão", "Italiano", "Japonês", "Outro"];
const STATUS_LIST = [
    { value: "want_to_read", label: "Quero Ler" },
    { value: "reading", label: "Lendo" },
    { value: "read", label: "Lido" },
    { value: "paused", label: "Pausado" },
];

const EMPTY = {
    title: "",
    author: "",
    publisher: "",
    publishYear: "",
    pages: "",
    isbn: "",
    cdd: "",
    cdu: "",
    language: "Português",
    edition: "",
    volumes: "1",
    synopsis: "",
    shelfLocation: "",
    categoryId: "",
    copies: "1",
    status: "want_to_read",
    rating: "0",
    isFeatured: false,
};

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

function coverSrc(path) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return API_BASE + path;
}

// ─── Paleta de cores para categorias ────────────────────────
const PRESET_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b", "#0d6efd"];

// ─── Modal de Categorias ─────────────────────────────────────
function CategoryModal({ categories, onSelect, onCreated, onUpdated, onDeleted, onClose }) {
    const [name, setName] = useState("");
    const [color, setColor] = useState("#3b82f6");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Edição inline
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState("#3b82f6");
    const [editSaving, setEditSaving] = useState(false);

    // Exclusão
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        setError("");
        try {
            const { data } = await api.post("/categories", { name: name.trim(), color, icon: "fa-book" });
            onCreated(data);
            setName("");
        } catch (err) {
            setError(err.response?.data?.error || "Erro ao criar categoria");
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (cat) => {
        setEditingId(cat.id);
        setEditName(cat.name);
        setEditColor(cat.color || "#3b82f6");
        setConfirmDeleteId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName("");
    };

    const handleUpdate = async (catId) => {
        if (!editName.trim()) return;
        setEditSaving(true);
        try {
            const { data } = await api.put(`/categories/${catId}`, { name: editName.trim(), color: editColor, icon: "fa-book" });
            onUpdated(data);
            setEditingId(null);
        } catch (err) {
            setError(err.response?.data?.error || "Erro ao editar categoria");
        } finally {
            setEditSaving(false);
        }
    };

    const handleDelete = async (catId) => {
        setDeleting(true);
        try {
            await api.delete(`/categories/${catId}`);
            onDeleted(catId);
            setConfirmDeleteId(null);
        } catch (err) {
            setError(err.response?.data?.error || "Erro ao excluir categoria");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-[--color-surface] rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
                {/* Cabeçalho */}
                <div className="flex items-center justify-between p-4 border-b border-[--color-border]">
                    <h2 className="font-bold text-[--color-text] flex items-center gap-2">
                        <i className="fa-solid fa-tags text-primary-600" /> Categorias
                    </h2>
                    <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg" type="button">
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                {/* Lista de categorias existentes */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {error && (
                        <p className="text-xs text-red-500 flex items-center gap-1 px-1 pb-1">
                            <i className="fa-solid fa-circle-exclamation" /> {error}
                        </p>
                    )}
                    {categories.length === 0 ? (
                        <p className="text-sm text-center text-[--color-muted] py-6">Nenhuma categoria criada ainda. Crie a primeira abaixo!</p>
                    ) : (
                        categories.map((c) =>
                            editingId === c.id ? (
                                /* ── Modo edição inline ── */
                                <div
                                    key={c.id}
                                    className="p-2 rounded-lg border border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 space-y-2"
                                >
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={editColor}
                                            onChange={(e) => setEditColor(e.target.value)}
                                            className="w-8 h-8 rounded-lg cursor-pointer border border-[--color-border] p-0.5 flex-shrink-0"
                                        />
                                        <input
                                            className="input flex-1 text-sm"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleUpdate(c.id);
                                                }
                                                if (e.key === "Escape") cancelEdit();
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pb-1">
                                        {PRESET_COLORS.map((pc) => (
                                            <button
                                                key={pc}
                                                type="button"
                                                onClick={() => setEditColor(pc)}
                                                className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${editColor === pc ? "border-slate-700 dark:border-white scale-110" : "border-transparent"}`}
                                                style={{ background: pc }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button type="button" onClick={cancelEdit} className="btn-ghost text-xs py-1 px-2">
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUpdate(c.id)}
                                            disabled={editSaving || !editName.trim()}
                                            className="btn-primary text-xs py-1 px-3 disabled:opacity-60"
                                        >
                                            {editSaving ? <i className="fa-solid fa-spinner animate-spin" /> : "Salvar"}
                                        </button>
                                    </div>
                                </div>
                            ) : confirmDeleteId === c.id ? (
                                /* ── Confirmação de exclusão ── */
                                <div
                                    key={c.id}
                                    className="p-2.5 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 flex items-center gap-2"
                                >
                                    <span className="flex-1 text-xs text-red-700 dark:text-red-300">
                                        Excluir <strong>"{c.name}"</strong>? Os livros não serão excluídos.
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="btn-ghost text-xs py-1 px-2 flex-shrink-0"
                                    >
                                        Não
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(c.id)}
                                        disabled={deleting}
                                        className="btn-danger text-xs py-1 px-2 flex-shrink-0 disabled:opacity-60"
                                    >
                                        {deleting ? <i className="fa-solid fa-spinner animate-spin" /> : "Sim, excluir"}
                                    </button>
                                </div>
                            ) : (
                                /* ── Item normal ── */
                                <div
                                    key={c.id}
                                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                                >
                                    <button type="button" onClick={() => onSelect(c)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color || "#3b82f6" }} />
                                        <span className="flex-1 text-sm font-medium text-[--color-text] truncate">{c.name}</span>
                                        {c.bookCount > 0 && (
                                            <span className="text-xs text-[--color-muted] flex-shrink-0">{c.bookCount} livro(s)</span>
                                        )}
                                    </button>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => startEdit(c)}
                                            className="btn-ghost p-1.5 text-[--color-muted] hover:text-primary-600 rounded"
                                            title="Editar"
                                        >
                                            <i className="fa-solid fa-pen text-xs" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDeleteId(c.id)}
                                            className="btn-ghost p-1.5 text-[--color-muted] hover:text-red-500 rounded"
                                            title="Excluir"
                                        >
                                            <i className="fa-solid fa-trash text-xs" />
                                        </button>
                                    </div>
                                </div>
                            ),
                        )
                    )}
                </div>

                {/* Formulário de nova categoria */}
                <div className="border-t border-[--color-border] p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
                    <p className="text-xs font-semibold text-[--color-muted] uppercase tracking-wide">
                        <i className="fa-solid fa-plus mr-1" /> Nova categoria
                    </p>
                    <form onSubmit={handleCreate} className="flex gap-2 items-center">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-9 h-9 rounded-lg cursor-pointer border border-[--color-border] p-0.5 flex-shrink-0"
                            title="Cor da categoria"
                        />
                        <input
                            className="input flex-1 text-sm"
                            placeholder="Nome da categoria"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <button type="submit" disabled={saving || !name.trim()} className="btn-primary px-3 py-2 disabled:opacity-60 flex-shrink-0">
                            {saving ? <i className="fa-solid fa-spinner animate-spin text-sm" /> : <i className="fa-solid fa-plus text-sm" />}
                        </button>
                    </form>
                    {/* Paleta de cores rápidas */}
                    <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setColor(c)}
                                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? "border-slate-700 dark:border-white scale-110" : "border-transparent"}`}
                                style={{ background: c }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function BookFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;
    const { addToast } = useToast();
    const { user } = useAuth();
    const canUseGoogleBooks = user?.plan === "premium" || user?.plan === "pro" || user?.plan === "master";

    const [form, setForm] = useState(EMPTY);
    const [categories, setCategories] = useState([]);
    const [coverFile, setCoverFile] = useState(null);
    const [coverPreview, setCoverPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [gbLoading, setGbLoading] = useState(false);
    const [gbQuery, setGbQuery] = useState("");
    const [showCatModal, setShowCatModal] = useState(false);

    const refreshCategories = () =>
        api
            .get("/categories")
            .then((r) => setCategories(r.data))
            .catch(() => {});

    useEffect(() => {
        refreshCategories();
        if (isEdit) {
            setLoading(true);
            api.get("/books/" + id)
                .then((r) => {
                    const b = r.data;
                    setForm({
                        title: b.title || "",
                        author: b.author || "",
                        publisher: b.publisher || "",
                        publishYear: b.publishYear || "",
                        pages: b.pages || "",
                        isbn: b.isbn || "",
                        cdd: b.cdd || "",
                        cdu: b.cdu || "",
                        language: b.language || "Português",
                        edition: b.edition || "",
                        volumes: b.volumes || "1",
                        synopsis: b.synopsis || "",
                        shelfLocation: b.shelfLocation || "",
                        categoryId: b.categoryId || "",
                        copies: b.copies || "1",
                        status: b.status || "want_to_read",
                        rating: b.rating || "0",
                        isFeatured: !!b.isFeatured,
                    });
                    if (b.coverImagePath) setCoverPreview(coverSrc(b.coverImagePath));
                })
                .finally(() => setLoading(false));
        }
    }, [id, isEdit]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    };

    const handleCoverChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
    };

    const searchGoogleBooks = async () => {
        if (!gbQuery.trim()) return;
        setGbLoading(true);
        try {
            const { data } = await api.get("/google-books/search", { params: { q: gbQuery } });
            const item = data.items?.[0];
            if (item) {
                // Tenta encontrar categoria correspondente nas categorias já cadastradas
                let matchedCategoryId = "";
                if (item.categories?.length > 0 && categories.length > 0) {
                    const normalized = item.categories[0].split("/")[0].trim().toLowerCase();
                    const match = categories.find(
                        (c) =>
                            c.name.toLowerCase() === normalized ||
                            normalized.includes(c.name.toLowerCase()) ||
                            c.name.toLowerCase().includes(normalized),
                    );
                    if (match) matchedCategoryId = String(match.id);
                }

                setForm((f) => ({
                    ...f,
                    title: item.title || f.title,
                    author: (item.authors || []).join(", ") || f.author,
                    publisher: item.publisher || f.publisher,
                    publishYear: item.publishedDate?.slice(0, 4) || f.publishYear,
                    pages: item.pageCount || f.pages,
                    isbn: item.isbn || f.isbn,
                    synopsis: item.description ? item.description.slice(0, 1000) : f.synopsis,
                    categoryId: matchedCategoryId || f.categoryId,
                }));

                if (matchedCategoryId) {
                    const catName = categories.find((c) => String(c.id) === matchedCategoryId)?.name;
                    if (catName) addToast(`Categoria "${catName}" detectada automaticamente.`, "info");
                }
            } else {
                addToast("Nenhum livro encontrado no Google Books para esta busca.", "warning");
            }
        } catch {
            addToast("Erro ao buscar no Google Books.", "error");
        } finally {
            setGbLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSaving(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => {
                if (v !== "") fd.append(k, v);
            });
            if (coverFile) fd.append("coverFile", coverFile);

            if (isEdit) {
                await api.put("/books/" + id, fd);
            } else {
                const { data } = await api.post("/books", fd);
                navigate("/books/" + data.id);
                return;
            }
            navigate("/books/" + id);
        } catch (err) {
            setError(err.response?.data?.error || "Erro ao salvar livro");
        } finally {
            setSaving(false);
        }
    };

    if (loading)
        return (
            <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );

    return (
        <div className="max-w-3xl mx-auto space-y-5">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="btn-ghost p-2">
                    <i className="fa-solid fa-arrow-left" />
                </button>
                <h1 className="text-2xl font-bold text-[--color-text]">{isEdit ? "Editar livro" : "Adicionar livro"}</h1>
            </div>

            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                    <i className="fa-solid fa-circle-exclamation mr-2" />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Google Books */}
                {canUseGoogleBooks ? (
                    <div className="card p-4 space-y-2">
                        <p className="text-sm font-medium text-[--color-text]">
                            <i className="fa-brands fa-google mr-1 text-blue-500" /> Buscar no Google Books
                        </p>
                        <div className="flex gap-2">
                            <input
                                className="input flex-1"
                                placeholder="Ex: Dom Casmurro Machado de Assis"
                                value={gbQuery}
                                onChange={(e) => setGbQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchGoogleBooks())}
                            />
                            <button type="button" onClick={searchGoogleBooks} disabled={gbLoading} className="btn-secondary">
                                {gbLoading ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-magnifying-glass" />}
                                Buscar
                            </button>
                        </div>
                        <p className="text-xs text-[--color-muted]">O primeiro resultado preencherá os campos automaticamente.</p>
                    </div>
                ) : (
                    <div className="card p-4 flex items-center justify-between gap-4 border border-dashed border-[--color-border] opacity-80">
                        <div className="flex items-center gap-3">
                            <i className="fa-brands fa-google text-slate-400 text-xl" />
                            <div>
                                <p className="text-sm font-medium text-[--color-text]">
                                    Buscar no Google Books
                                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 px-1.5 py-0.5 rounded font-semibold">
                                        PREMIUM
                                    </span>
                                </p>
                                <p className="text-xs text-[--color-muted] mt-0.5">
                                    Preencha os campos automaticamente buscando livros via Google Books.
                                </p>
                            </div>
                        </div>
                        <Link to="/billing/upgrade?feature=google-books" className="btn-primary text-xs px-3 py-1.5 flex-shrink-0">
                            <i className="fa-solid fa-arrow-up mr-1" /> Upgrade
                        </Link>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Capa */}
                    <div className="card p-4 flex flex-col items-center gap-3">
                        <div className="w-full aspect-[2/3] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                            {coverPreview ? (
                                <img src={coverPreview} alt="preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[--color-muted]">
                                    <i className="fa-solid fa-image text-4xl" />
                                </div>
                            )}
                        </div>
                        <label className="btn-secondary w-full justify-center cursor-pointer text-sm">
                            <i className="fa-solid fa-upload" /> Upload capa
                            <input type="file" accept="image/*" className="sr-only" onChange={handleCoverChange} />
                        </label>
                        {coverPreview && (
                            <button
                                type="button"
                                onClick={() => {
                                    setCoverFile(null);
                                    setCoverPreview(null);
                                }}
                                className="btn-ghost text-sm text-red-500 w-full justify-center"
                            >
                                <i className="fa-solid fa-trash text-xs" /> Remover
                            </button>
                        )}
                    </div>

                    {/* Campos principais */}
                    <div className="md:col-span-2 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                                <label className="label">Título *</label>
                                <input name="title" required className="input" value={form.title} onChange={handleChange} />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="label">Autor *</label>
                                <input name="author" required className="input" value={form.author} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="label">Editora</label>
                                <input name="publisher" className="input" value={form.publisher} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="label">Ano de publicação</label>
                                <input
                                    name="publishYear"
                                    type="number"
                                    min="1"
                                    max="2100"
                                    className="input"
                                    value={form.publishYear}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="label">Páginas</label>
                                <input name="pages" type="number" min="1" className="input" value={form.pages} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="label">ISBN</label>
                                <input name="isbn" className="input" value={form.isbn} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="label">Idioma</label>
                                <select name="language" className="input" value={form.language} onChange={handleChange}>
                                    {LANGUAGE_LIST.map((l) => (
                                        <option key={l} value={l}>
                                            {l}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">Edição</label>
                                <input name="edition" className="input" value={form.edition} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="label">Status</label>
                                <select name="status" className="input" value={form.status} onChange={handleChange}>
                                    {STATUS_LIST.map((s) => (
                                        <option key={s.value} value={s.value}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">Categoria</label>
                                <div className="flex gap-1.5">
                                    <select name="categoryId" className="input flex-1" value={form.categoryId} onChange={handleChange}>
                                        <option value="">Sem categoria</option>
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setShowCatModal(true)}
                                        className="btn-secondary px-3 flex-shrink-0"
                                        title="Gerenciar / criar categorias"
                                    >
                                        <i className="fa-solid fa-tags text-sm" />
                                    </button>
                                </div>
                                {form.categoryId &&
                                    (() => {
                                        const cat = categories.find((c) => String(c.id) === String(form.categoryId));
                                        return cat ? (
                                            <p className="mt-1 text-xs text-[--color-muted] flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full inline-block" style={{ background: cat.color || "#3b82f6" }} />
                                                {cat.name}
                                            </p>
                                        ) : null;
                                    })()}
                            </div>
                            <div>
                                <label className="label">Avaliação (0-5)</label>
                                <input name="rating" type="number" min="0" max="5" className="input" value={form.rating} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="label">Exemplares</label>
                                <input name="copies" type="number" min="1" className="input" value={form.copies} onChange={handleChange} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sinopse */}
                <div className="card p-4">
                    <label className="label">Sinopse</label>
                    <textarea name="synopsis" rows={4} className="input resize-none" value={form.synopsis} onChange={handleChange} />
                </div>

                {/* Campos extras */}
                <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                        <label className="label">CDD</label>
                        <input name="cdd" className="input" value={form.cdd} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="label">CDU</label>
                        <input name="cdu" className="input" value={form.cdu} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="label">Localização</label>
                        <input name="shelfLocation" className="input" value={form.shelfLocation} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="label">Volumes</label>
                        <input name="volumes" type="number" min="1" className="input" value={form.volumes} onChange={handleChange} />
                    </div>
                    <div className="sm:col-span-4 flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isFeatured"
                            name="isFeatured"
                            checked={form.isFeatured}
                            onChange={handleChange}
                            className="w-4 h-4 accent-primary-600"
                        />
                        <label htmlFor="isFeatured" className="text-sm text-[--color-text] cursor-pointer">
                            Marcar como destaque
                        </label>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
                        Cancelar
                    </button>
                    <button type="submit" disabled={saving} className="btn-primary">
                        {saving ? (
                            <>
                                <i className="fa-solid fa-spinner animate-spin" /> Salvando...
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-check" /> {isEdit ? "Salvar alterações" : "Adicionar livro"}
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Modal de categorias */}
            {showCatModal && (
                <CategoryModal
                    categories={categories}
                    onSelect={(cat) => {
                        setForm((f) => ({ ...f, categoryId: String(cat.id) }));
                        setShowCatModal(false);
                    }}
                    onCreated={(newCat) => {
                        setCategories((prev) => [...prev, { ...newCat, bookCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
                        setForm((f) => ({ ...f, categoryId: String(newCat.id) }));
                        setShowCatModal(false);
                        addToast(`Categoria "${newCat.name}" criada e selecionada.`, "success");
                    }}
                    onUpdated={(updated) => {
                        setCategories((prev) =>
                            prev
                                .map((c) => (c.id === updated.id ? { ...c, name: updated.name, color: updated.color } : c))
                                .sort((a, b) => a.name.localeCompare(b.name)),
                        );
                        addToast(`Categoria "${updated.name}" atualizada.`, "success");
                    }}
                    onDeleted={(catId) => {
                        const cat = categories.find((c) => c.id === catId);
                        setCategories((prev) => prev.filter((c) => c.id !== catId));
                        if (String(form.categoryId) === String(catId)) {
                            setForm((f) => ({ ...f, categoryId: "" }));
                        }
                        if (cat) addToast(`Categoria "${cat.name}" excluída.`, "success");
                    }}
                    onClose={() => setShowCatModal(false)}
                />
            )}
        </div>
    );
}
