import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../../api/axios";
import StarRating from "../../components/UI/StarRating";
import StatusBadge from "../../components/Book/StatusBadge";
import { useAuth } from "../../hooks/useAuth";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

// Retorna URL correta da capa (externas usadas como estão; locais recebem prefixo do servidor)
function coverSrc(path) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return API_BASE + path;
}

const STATUS_LABELS = {
    want_to_read: "Quero Ler",
    reading: "Lendo",
    read: "Lido",
    paused: "Pausado",
};

export default function BookDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [error, setError] = useState("");
    const [readingHistory, setReadingHistory] = useState([]);
    const [bookLoans, setBookLoans] = useState([]);
    const [enriching, setEnriching] = useState(false);
    const [enrichMsg, setEnrichMsg] = useState("");

    const canEnrich = ["premium", "pro", "master"].includes(user?.plan);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.get("/books/" + id),
            api.get("/reading/book/" + id).catch(() => ({ data: [] })),
            api.get("/loans", { params: { pageSize: 50 } }).catch(() => ({ data: { data: [] } })),
        ])
            .then(([bookRes, readingRes, loansRes]) => {
                setBook(bookRes.data);
                setReadingHistory(readingRes.data || []);
                setBookLoans((loansRes.data?.data || []).filter((l) => l.bookId == id));
            })
            .catch(() => setError("Livro não encontrado."))
            .finally(() => setLoading(false));
    }, [id]);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await api.delete("/books/" + id);
            navigate("/books");
        } catch {
            setError("Erro ao excluir livro.");
            setDeleting(false);
        }
    };

    const handleEnrich = async () => {
        setEnriching(true);
        setEnrichMsg("");
        try {
            const res = await api.post(`/google-books/enrich/${id}`);
            setEnrichMsg(res.data.message || "Dados enriquecidos com sucesso!");
            // Recarrega o livro com os novos dados
            const bookRes = await api.get("/books/" + id);
            setBook(bookRes.data);
        } catch (err) {
            setEnrichMsg(err.response?.data?.message || err.response?.data?.error || "Erro ao enriquecer dados");
        } finally {
            setEnriching(false);
        }
    };

    if (loading)
        return (
            <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );

    if (error || !book)
        return (
            <div className="card p-8 text-center">
                <div className="text-5xl mb-3">⚠️</div>
                <p className="text-[--color-muted]">{error || "Livro não encontrado."}</p>
                <button onClick={() => navigate("/books")} className="btn-primary mt-4">
                    Voltar à lista
                </button>
            </div>
        );

    const infoRows = [
        { label: "Editora", value: book.publisher },
        { label: "Ano", value: book.publishYear },
        { label: "Páginas", value: book.pages },
        { label: "ISBN", value: book.isbn },
        { label: "Idioma", value: book.language },
        { label: "Edição", value: book.edition },
        { label: "Volumes", value: book.volumes },
        { label: "Exemplares", value: book.copies },
        { label: "CDD", value: book.cdd },
        { label: "CDU", value: book.cdu },
        { label: "Localização", value: book.shelfLocation },
        { label: "Categoria", value: book.categoryName },
        { label: "Emprestado", value: book.isLoaned ? "Sim" : "Não" },
    ].filter((r) => r.value);

    return (
        <div className="space-y-5">
            {/* breadcrumb + actions */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 text-sm text-[--color-muted]">
                    <button onClick={() => navigate("/books")} className="hover:text-primary-600 transition-colors">
                        Meus livros
                    </button>
                    <i className="fa-solid fa-chevron-right text-xs" />
                    <span className="text-[--color-text] font-medium line-clamp-1 max-w-xs">{book.title}</span>
                </div>
                <div className="flex gap-2">
                    {canEnrich && (
                        <button
                            onClick={handleEnrich}
                            disabled={enriching}
                            className="btn-secondary text-sm"
                            title="Preencher campos vazios com dados do Google Books"
                        >
                            {enriching ? (
                                <>
                                    <i className="fa-solid fa-spinner animate-spin" /> Enriquecendo...
                                </>
                            ) : (
                                <>
                                    <i className="fa-brands fa-google" /> Enriquecer
                                </>
                            )}
                        </button>
                    )}
                    <Link to={"/books/" + id + "/edit"} className="btn-secondary text-sm">
                        <i className="fa-solid fa-pen" /> Editar
                    </Link>
                    <button onClick={() => setConfirm(true)} className="btn-danger text-sm">
                        <i className="fa-solid fa-trash" /> Excluir
                    </button>
                </div>
            </div>

            {enrichMsg && (
                <div
                    className={`p-3 rounded-lg text-sm flex items-center gap-2 ${enrichMsg.includes("Erro") || enrichMsg.includes("erro") ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700" : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700"}`}
                >
                    <i
                        className={`fa-solid ${enrichMsg.includes("Erro") || enrichMsg.includes("erro") ? "fa-circle-exclamation" : "fa-circle-check"}`}
                    />
                    {enrichMsg}
                    <button onClick={() => setEnrichMsg("")} className="ml-auto">
                        <i className="fa-solid fa-xmark text-xs" />
                    </button>
                </div>
            )}

            {/* main card */}
            <div className="card p-5 flex flex-col sm:flex-row gap-6">
                {/* cover */}
                <div className="flex-shrink-0 w-36 h-52 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 self-start">
                    {book.coverImagePath ? (
                        <img src={coverSrc(book.coverImagePath)} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[--color-muted]">
                            <i className="fa-solid fa-book text-4xl" />
                        </div>
                    )}
                </div>

                {/* info */}
                <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3 flex-wrap">
                        <StatusBadge status={book.status} />
                        {book.isFeatured && (
                            <span className="badge-want text-xs">
                                <i className="fa-solid fa-star" /> Destaque
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-[--color-text]">{book.title}</h1>
                    <p className="text-lg text-[--color-muted]">{book.author}</p>
                    <StarRating value={Number(book.rating || 0)} onChange={() => {}} size="lg" />
                    <p className="text-sm text-[--color-muted]">
                        Status: <strong className="text-[--color-text]">{STATUS_LABELS[book.status] || book.status}</strong>
                    </p>
                    {book.synopsis && (
                        <p className="text-sm text-[--color-text] leading-relaxed pt-1 border-t border-[--color-border]">{book.synopsis}</p>
                    )}
                </div>
            </div>

            {/* metadata table */}
            {infoRows.length > 0 && (
                <div className="card p-5">
                    <h2 className="text-sm font-semibold text-[--color-muted] uppercase tracking-wide mb-3">Informações</h2>
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                        {infoRows.map((r) => (
                            <div key={r.label}>
                                <dt className="text-xs text-[--color-muted]">{r.label}</dt>
                                <dd className="text-sm text-[--color-text] font-medium">{r.value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}

            {/* Histórico de leitura + Empréstimos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Histórico de leitura */}
                <div className="card p-5">
                    <h2 className="font-semibold text-[--color-text] mb-3">
                        <i className="fa-solid fa-book-open mr-2 text-blue-500" />
                        Histórico de leitura
                    </h2>
                    {readingHistory.length === 0 ? (
                        <p className="text-sm text-[--color-muted]">Nenhum registro de leitura.</p>
                    ) : (
                        <div className="space-y-2">
                            {readingHistory.map((r) => (
                                <div key={r.id} className="text-sm border-b border-[--color-border] pb-2 last:border-0">
                                    <div className="flex justify-between">
                                        <span className="text-[--color-muted]">
                                            {r.startDate ? new Date(r.startDate).toLocaleDateString("pt-BR") : "—"}
                                        </span>
                                        {r.endDate && (
                                            <span className="text-green-600 text-xs">
                                                <i className="fa-solid fa-check mr-1" />
                                                Concluído
                                            </span>
                                        )}
                                    </div>
                                    {r.endDate && (
                                        <p className="text-xs text-[--color-muted]">Finalizado: {new Date(r.endDate).toLocaleDateString("pt-BR")}</p>
                                    )}
                                    {r.notes && <p className="text-xs italic text-[--color-muted] truncate">"{r.notes}"</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Empréstimos */}
                <div className="card p-5">
                    <h2 className="font-semibold text-[--color-text] mb-3">
                        <i className="fa-solid fa-handshake mr-2 text-orange-500" />
                        Empréstimos
                    </h2>
                    {bookLoans.length === 0 ? (
                        <p className="text-sm text-[--color-muted]">Nenhum empréstimo registrado.</p>
                    ) : (
                        <div className="space-y-2">
                            {bookLoans.map((l) => (
                                <div key={l.id} className="text-sm border-b border-[--color-border] pb-2 last:border-0">
                                    <div className="flex justify-between">
                                        <span className="font-medium text-[--color-text]">{l.borrowerName}</span>
                                        {l.isReturned ? (
                                            <span className="text-green-600 text-xs">
                                                <i className="fa-solid fa-check mr-1" />
                                                Devolvido
                                            </span>
                                        ) : (
                                            <span className="text-orange-500 text-xs">
                                                <i className="fa-solid fa-clock mr-1" />
                                                Em aberto
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[--color-muted]">{l.borrowerPhone}</p>
                                    <p className="text-xs text-[--color-muted]">{l.loanDate && new Date(l.loanDate).toLocaleDateString("pt-BR")}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* delete confirm modal */}
            {confirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="card w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-lg font-bold text-[--color-text]">Confirmar exclusão</h3>
                        <p className="text-sm text-[--color-muted]">
                            Tem certeza que deseja excluir <strong>«{book.title}»</strong>? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirm(false)} className="btn-secondary">
                                Cancelar
                            </button>
                            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
                                {deleting ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-trash" />}
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
