import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import Pagination from "../../components/UI/Pagination";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

function coverSrc(path) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return API_BASE + path;
}

const EMPTY_LOAN = { bookId: "", borrowerName: "", borrowerPhone: "", loanDate: new Date().toISOString().slice(0, 10), notes: "" };

export default function LoansPage() {
    const [tab, setTab] = useState("active");
    const [loans, setLoans] = useState([]);
    const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 15 });
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState(EMPTY_LOAN);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [books, setBooks] = useState([]);

    const load = useCallback(
        (page = 1, activeTab = tab) => {
            setLoading(true);
            const active = activeTab === "active" ? "true" : activeTab === "history" ? "false" : undefined;
            api.get("/loans", { params: { page, pageSize: 15, active } })
                .then((r) => {
                    setLoans(r.data.data || []);
                    setMeta({ total: r.data.total, page, pageSize: 15 });
                })
                .finally(() => setLoading(false));
        },
        [tab],
    );

    useEffect(() => {
        load(1, tab);
    }, [tab, load]);

    useEffect(() => {
        api.get("/books", { params: { pageSize: 200 } }).then((r) => setBooks(r.data.items || []));
    }, []);

    const handleReturn = async (id) => {
        if (!confirm("Confirmar devolução?")) return;
        await api.put("/loans/" + id + "/return");
        load(1, tab);
    };

    const handleDelete = async (id) => {
        if (!confirm("Excluir este registro de empréstimo?")) return;
        await api.delete("/loans/" + id);
        load(1, tab);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError("");
        setSaving(true);
        try {
            await api.post("/loans", form);
            setModal(false);
            setForm(EMPTY_LOAN);
            setTab("active");
            load(1, "active");
        } catch (err) {
            setError(err.response?.data?.error || "Erro ao criar empréstimo");
        } finally {
            setSaving(false);
        }
    };

    const calcDays = (loanDate) => {
        if (!loanDate) return 0;
        const start = new Date(loanDate);
        const now = new Date();
        return Math.floor((now - start) / (1000 * 60 * 60 * 24));
    };

    const handleWhatsApp = (loan) => {
        const days = calcDays(loan.loanDate);
        const phone = loan.borrowerPhone.replace(/\D/g, "");
        const phoneCC = phone.startsWith("55") ? phone : "55" + phone;
        const dayLabel = days === 1 ? "dia" : "dias";
        const loanDateFormatted = loan.loanDate ? new Date(loan.loanDate).toLocaleDateString("pt-BR") : "";
        const msg =
            `Olá, ${loan.borrowerName}! Gostaria de solicitar a devolução do livro *${loan.title}*. ` +
            `Emprestado em ${loanDateFormatted}, você está com ele há *${days} ${dayLabel}*. ` +
            `Quando puder, por favor, nos retorne. Obrigado!`;
        window.open(`https://wa.me/${phoneCC}?text=${encodeURIComponent(msg)}`, "_blank");
    };

    const availableBooks = books.filter((b) => b.availableCopies > 0 || b.copies > 0);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-bold text-[--color-text]">
                    <i className="fa-solid fa-handshake text-primary-600 mr-2" />
                    Empréstimos
                </h1>
                <button
                    onClick={() => {
                        setModal(true);
                        setError("");
                    }}
                    className="btn-primary"
                >
                    <i className="fa-solid fa-plus" /> Novo empréstimo
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
                {[
                    { key: "active", label: "Ativos" },
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

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
            ) : loans.length === 0 ? (
                <div className="card p-8 text-center">
                    <i className="fa-solid fa-handshake text-4xl text-[--color-muted] mb-3" />
                    <p className="text-[--color-muted]">{tab === "active" ? "Nenhum empréstimo ativo." : "Nenhum empréstimo no histórico."}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {loans.map((l) => (
                        <div key={l.id} className="card p-4 flex gap-3 items-center">
                            <Link
                                to={"/books/" + l.bookId}
                                className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-slate-100 dark:bg-slate-800"
                            >
                                {l.coverImagePath ? (
                                    <img src={coverSrc(l.coverImagePath)} alt={l.title} className="w-full h-full object-cover" />
                                ) : (
                                    <i className="fa-solid fa-book text-slate-400 text-sm block mt-3 ml-2" />
                                )}
                            </Link>
                            <div className="flex-1 min-w-0">
                                <Link
                                    to={"/books/" + l.bookId}
                                    className="font-semibold text-[--color-text] text-sm hover:text-primary-600 truncate block"
                                >
                                    {l.title}
                                </Link>
                                <p className="text-xs text-[--color-muted]">{l.author}</p>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                    <span className="text-xs text-[--color-text]">
                                        <i className="fa-solid fa-user mr-1 text-[--color-muted]" />
                                        {l.borrowerName}
                                    </span>
                                    <span className="text-xs text-[--color-muted]">
                                        <i className="fa-solid fa-phone mr-1" />
                                        {l.borrowerPhone}
                                    </span>
                                    <span className="text-xs text-[--color-muted]">
                                        <i className="fa-solid fa-calendar mr-1" />
                                        {l.loanDate && new Date(l.loanDate).toLocaleDateString("pt-BR")}
                                    </span>
                                    {l.isReturned && l.returnDate && (
                                        <span className="text-xs text-green-600">
                                            <i className="fa-solid fa-check mr-1" />
                                            Devolvido: {new Date(l.returnDate).toLocaleDateString("pt-BR")}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0 items-center">
                                {!l.isReturned && (
                                    <>
                                        <button onClick={() => handleReturn(l.id)} className="btn-secondary text-xs">
                                            <i className="fa-solid fa-rotate-left" /> Devolver
                                        </button>
                                        {l.borrowerPhone && (
                                            <button
                                                onClick={() => handleWhatsApp(l)}
                                                className="btn-ghost p-1.5 text-green-500 hover:text-green-400"
                                                title={`Cobrar devolução via WhatsApp (${calcDays(l.loanDate)} dias)`}
                                            >
                                                <i className="fa-brands fa-whatsapp text-lg" />
                                            </button>
                                        )}
                                    </>
                                )}
                                <button onClick={() => handleDelete(l.id)} className="btn-ghost p-1.5 text-[--color-muted] hover:text-red-500">
                                    <i className="fa-solid fa-trash text-xs" />
                                </button>
                            </div>
                        </div>
                    ))}
                    <Pagination total={meta.total} page={meta.page} pageSize={meta.pageSize} onPageChange={(p) => load(p, tab)} />
                </div>
            )}

            {/* Modal novo empréstimo */}
            {modal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="card w-full max-w-md p-6 space-y-4">
                        <h2 className="text-lg font-bold text-[--color-text]">Novo empréstimo</h2>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <form onSubmit={handleCreate} className="space-y-3">
                            <div>
                                <label className="label">Livro *</label>
                                <select
                                    className="input"
                                    value={form.bookId}
                                    onChange={(e) => setForm((f) => ({ ...f, bookId: e.target.value }))}
                                    required
                                >
                                    <option value="">Selecione um livro...</option>
                                    {availableBooks.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.title} — {b.author}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">Nome do tomador *</label>
                                <input
                                    className="input"
                                    value={form.borrowerName}
                                    onChange={(e) => setForm((f) => ({ ...f, borrowerName: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Telefone *</label>
                                <input
                                    className="input"
                                    value={form.borrowerPhone}
                                    onChange={(e) => setForm((f) => ({ ...f, borrowerPhone: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Data do empréstimo</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={form.loanDate}
                                    onChange={(e) => setForm((f) => ({ ...f, loanDate: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="label">Observações</label>
                                <textarea
                                    className="input resize-none"
                                    rows={2}
                                    value={form.notes}
                                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setModal(false)} className="btn-secondary">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving} className="btn-primary">
                                    {saving ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-check" />}
                                    Registrar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
