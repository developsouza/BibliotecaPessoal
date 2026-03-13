import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import BookCard from "../../components/Book/BookCard";
import Pagination from "../../components/UI/Pagination";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const STATUS_OPTIONS = [
    { value: "", label: "Todos os status" },
    { value: "want_to_read", label: "Quero Ler" },
    { value: "reading", label: "Lendo" },
    { value: "read", label: "Lido" },
    { value: "paused", label: "Pausado" },
];
const SORT_OPTIONS = [
    { value: "recent", label: "Mais recentes" },
    { value: "title", label: "Titulo A-Z" },
    { value: "author", label: "Autor A-Z" },
    { value: "rating", label: "Melhor avaliados" },
];
const STATUS_QUICK = [
    { value: "want_to_read", label: "Quero Ler", icon: "fa-bookmark", color: "text-slate-500" },
    { value: "reading", label: "Lendo", icon: "fa-book-open", color: "text-blue-500" },
    { value: "read", label: "Lido", icon: "fa-check-circle", color: "text-green-500" },
    { value: "paused", label: "Pausado", icon: "fa-pause-circle", color: "text-yellow-500" },
];

// Formatos de exportação
const EXPORT_FORMATS = [
    { format: "csv", label: "Exportar CSV", icon: "fa-file-csv", free: false },
    { format: "xlsx", label: "Exportar Excel", icon: "fa-file-excel", free: false },
    { format: "pdf", label: "Exportar PDF", icon: "fa-file-pdf", free: false },
];

export default function BooksPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isPaidPlan = user?.plan && user.plan !== "free";
    const { addToast } = useToast();

    const [books, setBooks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [sort, setSort] = useState("recent");
    const [statusMenuId, setStatusMenuId] = useState(null); // id do livro com menu aberto
    const [statusUpdating, setStatusUpdating] = useState(null);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const PAGE_SIZE = 12;

    const fetchBooks = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, pageSize: PAGE_SIZE, sort };
            if (search) params.search = search;
            if (status) params.status = status;
            if (categoryId) params.categoryId = categoryId;
            const { data } = await api.get("/books", { params });
            setBooks(data.items);
            setTotalCount(data.totalCount);
        } finally {
            setLoading(false);
        }
    }, [page, search, status, categoryId, sort]);

    useEffect(() => {
        fetchBooks();
    }, [fetchBooks]);
    useEffect(() => {
        api.get("/categories")
            .then((r) => setCategories(r.data))
            .catch(() => {});
    }, []);
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput);
            setPage(1);
        }, 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    // Fechar menus ao clicar fora
    useEffect(() => {
        const handler = () => {
            setStatusMenuId(null);
            setExportMenuOpen(false);
        };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, []);

    const handleDelete = async (book) => {
        if (!confirm(`Excluir "${book.title}"?`)) return;
        await api.delete(`/books/${book.id}`);
        fetchBooks();
    };

    const handleQuickStatus = async (bookId, newStatus) => {
        setStatusUpdating(bookId);
        setStatusMenuId(null);
        try {
            await api.patch(`/books/${bookId}/status`, { status: newStatus });
            setBooks((prev) => prev.map((b) => (b.id === bookId ? { ...b, status: newStatus } : b)));
        } catch {
            addToast("Erro ao atualizar status.", "error");
        } finally {
            setStatusUpdating(null);
        }
    };

    const handleExport = async (format) => {
        setExportLoading(true);
        setExportMenuOpen(false);
        try {
            const resp = await api.get(`/books/export?format=${format}`, { responseType: "blob" });
            const ext = format;
            const mime =
                format === "xlsx"
                    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    : format === "pdf"
                      ? "application/pdf"
                      : format === "csv"
                        ? "text/csv"
                        : "application/json";
            const url = URL.createObjectURL(new Blob([resp.data], { type: mime }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `biblioteca.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            const msg = err.response?.data?.error || "Erro ao exportar. Verifique seu plano.";
            addToast(msg, "error");
        } finally {
            setExportLoading(false);
        }
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="space-y-5">
            {/* Cabeçalho */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-[--color-text]">
                        <i className="fa-solid fa-book text-primary-600 mr-2" />
                        Minha Biblioteca
                    </h1>
                    <p className="text-[--color-muted] text-sm mt-0.5">{totalCount} livro(s)</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Botão exportar */}
                    <div className="relative">
                        <button
                            className="btn-secondary flex items-center gap-2 text-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setExportMenuOpen((p) => !p);
                            }}
                            disabled={exportLoading}
                            title="Exportar biblioteca"
                        >
                            {exportLoading ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin" /> Exportando...
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-file-export" /> Exportar
                                </>
                            )}
                        </button>
                        {exportMenuOpen && (
                            <div
                                className="absolute right-0 top-full mt-1 z-50 card py-1 min-w-[170px] shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {EXPORT_FORMATS.map(({ format, label, icon, free }) => (
                                    <button
                                        key={format}
                                        onClick={() => (free || isPaidPlan ? handleExport(format) : navigate("/billing/upgrade?feature=export"))}
                                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[--color-text] hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                                    >
                                        <i className={`fa-solid ${icon} w-4 ${!free && !isPaidPlan ? "text-slate-400" : "text-primary-500"}`} />
                                        <span className={!free && !isPaidPlan ? "text-[--color-muted]" : ""}>{label}</span>
                                        {!free && !isPaidPlan && (
                                            <span className="ml-auto text-[10px] font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 px-1.5 py-0.5 rounded">
                                                PREMIUM
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button onClick={() => navigate("/books/new")} className="btn-primary">
                        <i className="fa-solid fa-plus" /> Adicionar livro
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="card p-4 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[--color-muted] text-sm" />
                    <input
                        className="input pl-9"
                        placeholder="Buscar titulo, autor ou ISBN..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
                <select
                    className="input w-auto"
                    value={categoryId}
                    onChange={(e) => {
                        setCategoryId(e.target.value);
                        setPage(1);
                    }}
                >
                    <option value="">Todas as categorias</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
                <select
                    className="input w-auto"
                    value={status}
                    onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                    }}
                >
                    {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <select
                    className="input w-auto"
                    value={sort}
                    onChange={(e) => {
                        setSort(e.target.value);
                        setPage(1);
                    }}
                >
                    {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Grid de livros */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
            ) : books.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="text-5xl mb-4">📚</div>
                    <h3 className="font-semibold text-lg text-[--color-text] mb-2">
                        {search || status || categoryId ? "Nenhum livro encontrado" : "Biblioteca vazia"}
                    </h3>
                    <p className="text-[--color-muted] text-sm mb-4">
                        {search || status || categoryId ? "Ajuste os filtros ou" : "Adicione seu primeiro livro!"}
                    </p>
                    <button onClick={() => navigate("/books/new")} className="btn-primary mx-auto">
                        <i className="fa-solid fa-plus" /> Adicionar livro
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {books.map((book) => (
                        <div key={book.id} className="relative group">
                            <BookCard book={book} onEdit={(b) => navigate(`/books/${b.id}/edit`)} onDelete={handleDelete} />
                            {/* Botão de status rápido */}
                            <div className="absolute bottom-20 right-1 z-10" onClick={(e) => e.stopPropagation()}>
                                <button
                                    className="w-7 h-7 rounded-full bg-white dark:bg-slate-700 shadow border border-[--color-border] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                                    title="Alterar status rapidamente"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setStatusMenuId((p) => (p === book.id ? null : book.id));
                                    }}
                                    disabled={statusUpdating === book.id}
                                >
                                    {statusUpdating === book.id ? (
                                        <i className="fa-solid fa-spinner fa-spin text-primary-500" />
                                    ) : (
                                        <i className="fa-solid fa-ellipsis-vertical text-[--color-muted]" />
                                    )}
                                </button>
                                {statusMenuId === book.id && (
                                    <div className="absolute right-0 bottom-8 card shadow-xl py-1 min-w-[150px] z-20">
                                        <p className="text-xs text-[--color-muted] px-3 pt-1 pb-1 font-medium">Alterar status</p>
                                        {STATUS_QUICK.map((s) => (
                                            <button
                                                key={s.value}
                                                onClick={() => handleQuickStatus(book.id, s.value)}
                                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-left ${book.status === s.value ? "font-semibold bg-slate-50 dark:bg-slate-800" : "text-[--color-text]"}`}
                                            >
                                                <i className={`fa-solid ${s.icon} ${s.color} w-4`} />
                                                {s.label}
                                                {book.status === s.value && <i className="fa-solid fa-check ml-auto text-primary-500" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
    );
}
