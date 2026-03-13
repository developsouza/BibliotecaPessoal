import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

// Opções de filtro de busca
const SEARCH_MODES = [
    { value: "general", label: "Todos os campos", prefix: "" },
    { value: "intitle", label: "Título", prefix: "intitle:" },
    { value: "inauthor", label: "Autor", prefix: "inauthor:" },
    { value: "isbn", label: "ISBN", prefix: "isbn:" },
];

function BookResult({ book, onImport, importing, isDuplicate }) {
    return (
        <div className={`card p-4 flex gap-3 relative transition-opacity ${isDuplicate ? "opacity-90" : ""}`}>
            {/* Badge duplicado */}
            {isDuplicate && !book.imported && (
                <div className="absolute top-2 right-2 z-10">
                    <span className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded-full px-2 py-0.5 font-medium">
                        <i className="fa-solid fa-triangle-exclamation text-[10px]" />
                        Já importado
                    </span>
                </div>
            )}

            {/* Capa */}
            <div className="flex-shrink-0 w-16">
                {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} className="w-16 h-24 object-cover rounded shadow" />
                ) : (
                    <div className="w-16 h-24 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center">
                        <i className="fa-solid fa-book text-slate-400 text-xl" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
                <p className="font-semibold text-sm text-[--color-text] leading-tight line-clamp-2 pr-16">{book.title}</p>
                <p className="text-xs text-[--color-muted]">{book.author}</p>
                {book.publisher && (
                    <p className="text-xs text-[--color-muted]">
                        {book.publisher}
                        {book.publishYear ? ` · ${book.publishYear}` : ""}
                    </p>
                )}
                {book.pages && <p className="text-xs text-[--color-muted]">{book.pages} págs.</p>}
                {book.isbn && <p className="text-xs text-[--color-muted] font-mono">ISBN: {book.isbn}</p>}
                {book.synopsis && <p className="text-xs text-[--color-muted] line-clamp-2 mt-1">{book.synopsis}</p>}

                {/* Botão importar / importado */}
                {book.imported ? (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                            <i className="fa-solid fa-check-circle" /> Importado!
                        </span>
                        {book.importedId && (
                            <Link to={`/books/${book.importedId}`} className="text-xs underline text-primary-600">
                                Ver livro
                            </Link>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => onImport(book)}
                        disabled={importing === book.googleId}
                        className={`mt-2 text-xs py-1 px-3 disabled:opacity-60 ${isDuplicate ? "btn-secondary" : "btn-primary"}`}
                    >
                        {importing === book.googleId ? (
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Importando...
                            </span>
                        ) : isDuplicate ? (
                            <span>
                                <i className="fa-solid fa-download mr-1" />
                                Importar mesmo assim
                            </span>
                        ) : (
                            <span>
                                <i className="fa-solid fa-download mr-1" />
                                Importar
                            </span>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function GoogleBooksPage() {
    const [query, setQuery] = useState("");
    const [searchMode, setSearchMode] = useState("general");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(null);
    const [error, setError] = useState("");
    const [existingIsbns, setExistingIsbns] = useState(new Set());
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();

    // Carregar ISBNs já cadastrados para identificar duplicatas
    useEffect(() => {
        if (user?.plan === "free") return;
        api.get("/books?pageSize=9999")
            .then(({ data }) => {
                const isbns = new Set((data.books || []).map((b) => b.isbn).filter(Boolean));
                setExistingIsbns(isbns);
            })
            .catch(() => {});
    }, [user?.plan]);

    // Plano free não tem acesso ao Google Books
    if (user?.plan === "free") {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <i className="fa-solid fa-magnifying-glass text-primary-600 text-xl" />
                    <h1 className="text-2xl font-bold text-[--color-text]">Google Books</h1>
                </div>
                <div className="card p-10 text-center space-y-4">
                    <div className="text-6xl">🔒</div>
                    <h2 className="text-xl font-bold text-[--color-text]">Recurso exclusivo para planos pagos</h2>
                    <p className="text-[--color-muted] max-w-md mx-auto">
                        A busca e importação de livros via Google Books está disponível nos planos <strong>Premium</strong> e <strong>Pro</strong>.
                        Faça upgrade para desbloquear esta funcionalidade.
                    </p>
                    <Link to="/billing/upgrade?feature=google-books" className="btn-primary inline-flex items-center gap-2 mt-2">
                        <i className="fa-solid fa-arrow-up" />
                        Ver planos
                    </Link>
                </div>
            </div>
        );
    }

    const buildSearchQuery = () => {
        const mode = SEARCH_MODES.find((m) => m.value === searchMode);
        return mode?.prefix ? `${mode.prefix}${query}` : query;
    };

    const search = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        setError("");
        setResults([]);
        setLoading(true);
        try {
            const q = buildSearchQuery();
            const { data } = await api.get(`/google-books/search?q=${encodeURIComponent(q)}`);
            setResults(data.items || []);
            if (!data.items?.length) setError("Nenhum resultado encontrado. Tente um termo diferente.");
        } catch (err) {
            const status = err.response?.status;
            const message = err.response?.data?.error;
            if (status === 403) {
                setError(message || "Seu plano não permite acesso ao Google Books. Faça upgrade para continuar.");
            } else if (status === 429) {
                setError(message || "Cota da API do Google Books esgotada. Tente novamente mais tarde.");
            } else if (status === 400) {
                setError(message || "Termo de busca inválido.");
            } else {
                setError(message || "Erro ao buscar no Google Books. Verifique sua conexão e tente novamente.");
            }
        } finally {
            setLoading(false);
        }
    };

    const importBook = async (book) => {
        setImporting(book.googleId);
        try {
            const { data } = await api.post("/google-books/import", {
                title: book.title,
                author: book.author,
                publisher: book.publisher,
                publishYear: book.publishYear,
                pages: book.pages,
                isbn: book.isbn,
                language: book.language === "pt" ? "Português" : book.language || "Português",
                synopsis: book.synopsis,
                coverUrl: book.coverUrl,
                googleCategories: book.categories || [],
            });
            setResults((prev) => prev.map((r) => (r.googleId === book.googleId ? { ...r, imported: true, importedId: data.book?.id } : r)));
            if (book.isbn) setExistingIsbns((prev) => new Set([...prev, book.isbn]));
            addToast(`"${book.title}" importado com sucesso!`);
        } catch (err) {
            if (err.response?.status === 409) {
                addToast(`"${book.title}" já existe na sua biblioteca!`, "warning");
                setResults((prev) => prev.map((r) => (r.googleId === book.googleId ? { ...r, isDuplicate: true } : r)));
            } else if (err.response?.status === 403) {
                addToast(err.response?.data?.error || "Limite do plano atingido. Faça upgrade para importar mais livros.", "error");
            } else {
                addToast(err.response?.data?.error || "Erro ao importar livro.", "error");
            }
        } finally {
            setImporting(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Cabeçalho */}
            <div className="flex items-center gap-3">
                <i className="fa-solid fa-magnifying-glass text-primary-600 text-xl" />
                <h1 className="text-2xl font-bold text-[--color-text]">Google Books</h1>
            </div>

            {/* Formulário de busca */}
            <div className="card p-6 space-y-3">
                <p className="text-sm text-[--color-muted]">Pesquise no catálogo do Google Books e importe livros diretamente para sua biblioteca.</p>

                {/* Filtro de campo */}
                <div className="flex flex-wrap gap-2">
                    {SEARCH_MODES.map((m) => (
                        <button
                            key={m.value}
                            type="button"
                            onClick={() => setSearchMode(m.value)}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                searchMode === m.value
                                    ? "bg-primary-600 text-white border-primary-600"
                                    : "border-[--color-border] text-[--color-muted] hover:border-primary-400 hover:text-primary-600"
                            }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={search} className="flex gap-2">
                    <div className="relative flex-1">
                        {searchMode !== "general" && (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-primary-600 font-mono font-bold pointer-events-none">
                                {SEARCH_MODES.find((m) => m.value === searchMode)?.prefix}
                            </span>
                        )}
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={
                                searchMode === "isbn" ? "Ex: 9788535935999" : searchMode === "inauthor" ? "Ex: Machado de Assis" : "Ex: Dom Casmurro"
                            }
                            className={`input w-full ${searchMode !== "general" ? "pl-20" : ""}`}
                        />
                    </div>
                    <button type="submit" disabled={loading || !query.trim()} className="btn-primary px-5 disabled:opacity-60">
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <i className="fa-solid fa-search" />
                        )}
                    </button>
                </form>
            </div>

            {/* Erro */}
            {error && (
                <div className="card p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    <i className="fa-solid fa-circle-xmark mr-2" />
                    {error}
                </div>
            )}

            {/* Resultados */}
            {results.length > 0 && (
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <p className="text-sm text-[--color-muted]">{results.length} resultado(s) encontrado(s)</p>
                        {results.some((r) => r.isDuplicate || (r.isbn && existingIsbns.has(r.isbn))) && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <i className="fa-solid fa-triangle-exclamation" />
                                Alguns já estão na sua biblioteca
                            </span>
                        )}
                        <button onClick={() => navigate("/books")} className="ml-auto text-xs text-primary-600 underline">
                            Ver biblioteca
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {results.map((book) => {
                            const isDuplicate = book.isDuplicate || (book.isbn && existingIsbns.has(book.isbn));
                            return (
                                <div key={book.googleId} className="relative">
                                    {book.imported && !isDuplicate && (
                                        <div className="absolute inset-0 z-10 rounded-xl flex items-center justify-center bg-black/40 pointer-events-none">
                                            <div className="bg-white dark:bg-slate-800 rounded-lg px-4 py-2 text-center">
                                                <i className="fa-solid fa-check-circle text-green-500 text-2xl mb-1" />
                                                <p className="text-xs font-medium text-[--color-text]">Importado!</p>
                                            </div>
                                        </div>
                                    )}
                                    <BookResult book={book} onImport={importBook} importing={importing} isDuplicate={!!isDuplicate} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Estado vazio */}
            {!loading && !results.length && !error && (
                <div className="card p-12 text-center">
                    <div className="text-5xl mb-4">🔍</div>
                    <p className="text-[--color-muted]">Digite um título, autor ou ISBN para buscar no Google Books.</p>
                    <p className="text-xs text-[--color-muted] mt-2">Use os filtros acima para refinar sua busca por título, autor ou ISBN.</p>
                </div>
            )}
        </div>
    );
}
