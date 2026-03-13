import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import StarRating from "../../components/UI/StarRating";
import Pagination from "../../components/UI/Pagination";
import { useToast } from "../../context/ToastContext";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

function coverSrc(path) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return API_BASE + path;
}

export default function ReadingPage() {
    const [tab, setTab] = useState("current"); // 'current' | 'history'
    const [readings, setReadings] = useState([]);
    const [history, setHistory] = useState([]);
    const [historyMeta, setHistoryMeta] = useState({ total: 0, page: 1, pageSize: 12 });
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // { progress } or null
    const [formData, setFormData] = useState({ currentPage: "", notes: "", rating: 0, endDate: "" });
    const [saving, setSaving] = useState(false);
    const [books, setBooks] = useState([]);
    const [newBookId, setNewBookId] = useState("");
    const [pageInputs, setPageInputs] = useState({}); // id -> value
    const [updatingPage, setUpdatingPage] = useState(null); // id being saved
    const { addToast } = useToast();

    const loadCurrent = useCallback(() => {
        setLoading(true);
        api.get("/reading")
            .then((r) => setReadings(r.data))
            .finally(() => setLoading(false));
    }, []);

    const loadHistory = useCallback((page = 1) => {
        setLoading(true);
        api.get("/reading/history", { params: { page, pageSize: 12 } })
            .then((r) => {
                setHistory(r.data.data);
                setHistoryMeta({ total: r.data.total, page, pageSize: 12 });
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (tab === "current") loadCurrent();
        else loadHistory();
    }, [tab, loadCurrent, loadHistory]);

    // Carregar livros disponíveis para iniciar nova leitura
    const loadBooks = useCallback(() => {
        api.get("/books", { params: { pageSize: 200, sort: "title" } })
            .then((r) => setBooks(r.data.items || []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        loadBooks();
    }, [loadBooks]);

    const openModal = (progress) => {
        setFormData({ currentPage: progress.currentPage || "", notes: progress.notes || "", rating: progress.rating || 0, endDate: "" });
        setModal(progress);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post("/reading", {
                bookId: modal.bookId,
                currentPage: formData.currentPage || undefined,
                notes: formData.notes || undefined,
                rating: formData.rating || undefined,
                endDate: formData.endDate || undefined,
            });
            setModal(null);
            loadCurrent();
            if (formData.endDate) loadBooks(); // livro marcado como lido sai do dropdown
            addToast(formData.endDate ? "Leitura concluída!" : "Progresso salvo!", "success");
        } catch (err) {
            addToast(err.response?.data?.error || "Erro ao salvar progresso.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleStartNew = async () => {
        if (!newBookId) return;
        setSaving(true);
        try {
            await api.post("/reading", { bookId: +newBookId });
            setNewBookId("");
            loadCurrent();
            loadBooks(); // Atualiza o dropdown para remover o livro iniciado
            addToast("Leitura iniciada com sucesso!", "success");
        } catch (err) {
            addToast(err.response?.data?.error || "Erro ao iniciar leitura.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Remover este registro de leitura?")) return;
        try {
            await api.delete("/reading/" + id);
            loadCurrent();
            loadBooks(); // livro pode voltar ao dropdown
        } catch (err) {
            addToast(err.response?.data?.error || "Erro ao remover leitura.", "error");
        }
    };

    const handleQuickPageUpdate = async (id, progress) => {
        const newPage = parseInt(pageInputs[id] ?? progress.currentPage ?? 0);
        if (isNaN(newPage) || newPage < 0) return;
        setUpdatingPage(id);
        try {
            const res = await api.patch(`/reading/${id}/page`, { currentPage: newPage });
            if (res.data.completed) {
                // Auto-concluído
                loadCurrent();
            } else {
                setReadings((prev) => prev.map((r) => (r.id === id ? { ...r, currentPage: res.data.currentPage } : r)));
                setPageInputs((p) => ({ ...p, [id]: undefined }));
            }
        } catch (err) {
            addToast(err.response?.data?.error || "Erro ao atualizar página", "error");
        } finally {
            setUpdatingPage(null);
        }
    };

    const notReadingBooks = books.filter((b) => b.status !== "reading" && b.status !== "read");

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-bold text-[--color-text]">
                    <i className="fa-solid fa-book-open text-primary-600 mr-2" />
                    Leituras
                </h1>
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    {[
                        { key: "current", label: "Em andamento" },
                        { key: "history", label: "Histórico" },
                    ].map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={
                                "px-3 py-1.5 text-sm rounded-md transition-colors " +
                                (tab === t.key
                                    ? "bg-white dark:bg-slate-700 shadow text-[--color-text] font-medium"
                                    : "text-[--color-muted] hover:text-[--color-text]")
                            }
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Iniciar nova leitura */}
            {tab === "current" && (
                <div className="card p-4 flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-48">
                        <label className="label">Iniciar leitura de um livro</label>
                        <select className="input" value={newBookId} onChange={(e) => setNewBookId(e.target.value)}>
                            <option value="">Selecione um livro...</option>
                            {notReadingBooks.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.title} — {b.author}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button onClick={handleStartNew} disabled={!newBookId || saving} className="btn-primary">
                        <i className="fa-solid fa-play" /> Iniciar
                    </button>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
            ) : tab === "current" ? (
                readings.length === 0 ? (
                    <div className="card p-8 text-center">
                        <i className="fa-solid fa-book-open text-4xl text-[--color-muted] mb-3" />
                        <p className="text-[--color-muted]">Nenhuma leitura em andamento.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {readings.map((r) => {
                            const pct = r.pages ? Math.min(100, Math.round((r.currentPage / r.pages) * 100)) : 0;
                            return (
                                <div key={r.id} className="card p-4 space-y-3">
                                    <div className="flex gap-3">
                                        <Link
                                            to={"/books/" + r.bookId}
                                            className="w-12 h-16 rounded overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0"
                                        >
                                            {r.coverImagePath ? (
                                                <img src={coverSrc(r.coverImagePath)} alt={r.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <i className="fa-solid fa-book text-slate-400 text-sm block mt-4 ml-3" />
                                            )}
                                        </Link>
                                        <div className="flex-1 min-w-0">
                                            <Link
                                                to={"/books/" + r.bookId}
                                                className="font-semibold text-[--color-text] text-sm hover:text-primary-600 truncate block"
                                            >
                                                {r.title}
                                            </Link>
                                            <p className="text-xs text-[--color-muted]">{r.author}</p>
                                            <p className="text-xs text-[--color-muted] mt-0.5">
                                                Iniciado: {r.startDate ? new Date(r.startDate).toLocaleDateString("pt-BR") : "—"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-[--color-muted]">
                                            <span>
                                                {r.currentPage || 0} / {r.pages || "?"} páginas
                                            </span>
                                            <span>{pct}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                            <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: pct + "%" }} />
                                        </div>
                                    </div>
                                    {r.notes && <p className="text-xs text-[--color-muted] italic truncate">"{r.notes}"</p>}
                                    {/* Atualização rápida de página */}
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
                                        <span className="text-xs text-[--color-muted] whitespace-nowrap">Ir para pág.:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max={r.pages || 9999}
                                            className="input text-xs py-1 w-20 flex-shrink-0"
                                            value={pageInputs[r.id] !== undefined ? pageInputs[r.id] : r.currentPage || ""}
                                            onChange={(e) => setPageInputs((p) => ({ ...p, [r.id]: e.target.value }))}
                                        />
                                        <button
                                            onClick={() => handleQuickPageUpdate(r.id, r)}
                                            disabled={updatingPage === r.id}
                                            className="btn-primary text-xs py-1 px-2 flex-shrink-0"
                                            title="Salvar página"
                                        >
                                            {updatingPage === r.id ? (
                                                <i className="fa-solid fa-spinner animate-spin" />
                                            ) : (
                                                <i className="fa-solid fa-check" />
                                            )}
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openModal(r)} className="btn-primary text-xs flex-1">
                                            <i className="fa-solid fa-edit" /> Atualizar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(r.id)}
                                            className="btn-ghost p-1.5 text-[--color-muted] hover:text-red-500"
                                        >
                                            <i className="fa-solid fa-trash text-xs" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : /* Histórico */
            history.length === 0 ? (
                <div className="card p-8 text-center">
                    <p className="text-[--color-muted]">Nenhum livro lido ainda.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {history.map((r) => (
                        <div key={r.id} className="card p-4 flex gap-3">
                            <Link
                                to={"/books/" + r.bookId}
                                className="w-10 h-14 rounded overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0"
                            >
                                {r.coverImagePath ? (
                                    <img src={coverSrc(r.coverImagePath)} alt={r.title} className="w-full h-full object-cover" />
                                ) : (
                                    <i className="fa-solid fa-book text-slate-400 text-sm block mt-3 ml-2" />
                                )}
                            </Link>
                            <div className="flex-1 min-w-0">
                                <Link
                                    to={"/books/" + r.bookId}
                                    className="font-semibold text-[--color-text] text-sm hover:text-primary-600 truncate block"
                                >
                                    {r.title}
                                </Link>
                                <p className="text-xs text-[--color-muted]">{r.author}</p>
                                <div className="flex items-center gap-3 mt-1">
                                    <StarRating value={Number(r.rating || 0)} onChange={() => {}} size="sm" />
                                    <p className="text-xs text-[--color-muted]">
                                        {r.startDate && new Date(r.startDate).toLocaleDateString("pt-BR")} →{" "}
                                        {r.endDate && new Date(r.endDate).toLocaleDateString("pt-BR")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                    <Pagination total={historyMeta.total} page={historyMeta.page} pageSize={historyMeta.pageSize} onPageChange={loadHistory} />
                </div>
            )}

            {/* Modal de atualização */}
            {modal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="card w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-lg font-bold text-[--color-text]">Atualizar progresso</h3>
                        <p className="text-sm text-[--color-muted] truncate">{modal.title}</p>

                        <div>
                            <label className="label">Página atual</label>
                            <input
                                type="number"
                                className="input"
                                value={formData.currentPage}
                                min="0"
                                max={modal.pages || 9999}
                                onChange={(e) => setFormData((f) => ({ ...f, currentPage: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="label">Anotações</label>
                            <textarea
                                className="input resize-none"
                                rows={3}
                                value={formData.notes}
                                onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="label">Avaliação</label>
                            <StarRating value={formData.rating} onChange={(v) => setFormData((f) => ({ ...f, rating: v }))} size="lg" />
                        </div>
                        <div>
                            <label className="label">Data de término (deixe em branco se ainda lendo)</label>
                            <input
                                type="date"
                                className="input"
                                value={formData.endDate}
                                onChange={(e) => setFormData((f) => ({ ...f, endDate: e.target.value }))}
                            />
                            <p className="text-xs text-[--color-muted] mt-1">Preencher marca o livro como Lido.</p>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setModal(null)} className="btn-secondary">
                                Cancelar
                            </button>
                            <button onClick={handleSave} disabled={saving} className="btn-primary">
                                {saving ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-check" />}
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
