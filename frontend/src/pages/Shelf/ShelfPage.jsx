import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useTheme } from "../../context/ThemeContext";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

function coverSrc(path) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return API_BASE + path;
}

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

const BOOKS_PER_SHELF = 10;

const FILTERS = [
    { key: "", label: "Todos" },
    { key: "reading", label: "Lendo" },
    { key: "read", label: "Lidos" },
    { key: "want_to_read", label: "Quero Ler" },
    { key: "paused", label: "Pausados" },
    { key: "loaned", label: "Emprestados" },
];

const STATUS_SPINE = {
    want_to_read: { color: "#64748b", label: "Quero Ler" },
    reading: { color: "#3b82f6", label: "Lendo" },
    read: { color: "#22c55e", label: "Lido" },
    paused: { color: "#f59e0b", label: "Pausado" },
};

// Cores da madeira: claro = carvalho, escuro = nogueira
const WOOD = {
    light: {
        frame: "linear-gradient(180deg,#a0673a 0%,#7a4a28 100%)",
        plank: "linear-gradient(180deg,#c8935a 0%,#9a6535 55%,#7a4a28 100%)",
        plankTop: "rgba(255,210,140,0.35)",
        plankBottom: "rgba(0,0,0,0.30)",
        bg: "#8b5635",
        shadow: "0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,200,120,0.2)",
        sidePanel: "linear-gradient(90deg,#6b3d20 0%,#8b5635 20%,#8b5635 80%,#6b3d20 100%)",
    },
    dark: {
        frame: "linear-gradient(180deg,#3a2213 0%,#21130a 100%)",
        plank: "linear-gradient(180deg,#5c3318 0%,#3a2010 55%,#21130a 100%)",
        plankTop: "rgba(180,110,60,0.25)",
        plankBottom: "rgba(0,0,0,0.50)",
        bg: "#2d180d",
        shadow: "0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(180,100,50,0.15)",
        sidePanel: "linear-gradient(90deg,#180d06 0%,#2d180d 20%,#2d180d 80%,#180d06 100%)",
    },
};

function BookSpine({ book }) {
    const spine = STATUS_SPINE[book.status] || STATUS_SPINE.want_to_read;
    const src = coverSrc(book.coverImagePath);

    return (
        <Link to={"/books/" + book.id} className="group relative flex-shrink-0" style={{ width: 56, height: 108 }}>
            {/* Book body */}
            <div
                className="w-full h-full overflow-hidden shadow-lg"
                style={{
                    borderRadius: "2px 4px 4px 2px",
                    transform: "translateY(0) rotate(0deg)",
                    transition: "transform 0.18s ease, box-shadow 0.18s ease",
                    boxShadow: "2px 2px 6px rgba(0,0,0,0.45)",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-12px) rotate(-1deg)";
                    e.currentTarget.style.boxShadow = "4px 14px 18px rgba(0,0,0,0.55)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0) rotate(0deg)";
                    e.currentTarget.style.boxShadow = "2px 2px 6px rgba(0,0,0,0.45)";
                }}
            >
                {/* Spine strip (left edge) */}
                <div
                    className="absolute left-0 top-0 bottom-0 z-10"
                    style={{ width: 7, background: `linear-gradient(90deg, ${spine.color}dd, ${spine.color}99)` }}
                />
                {/* Page edge simulation (right side) */}
                <div
                    className="absolute right-0 top-0 bottom-0 z-10"
                    style={{ width: 3, background: "linear-gradient(90deg,#e8e0d0,#f5f0e8)", opacity: 0.7 }}
                />
                {/* Cover */}
                {src ? (
                    <img
                        src={src}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.style.display = "none";
                        }}
                    />
                ) : (
                    <div
                        className="w-full h-full flex flex-col items-center justify-center gap-1 px-1"
                        style={{ background: `linear-gradient(135deg,${spine.color}44,${spine.color}22)` }}
                    >
                        <i className="fa-solid fa-book text-sm" style={{ color: spine.color }} />
                        <p
                            className="text-center font-medium leading-tight"
                            style={{
                                fontSize: 9,
                                color: spine.color,
                                display: "-webkit-box",
                                WebkitLineClamp: 5,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {book.title}
                        </p>
                    </div>
                )}

                {/* Loaned badge */}
                {book.availableCopies < book.copies && (
                    <div className="absolute top-1 right-3 z-20">
                        <span
                            className="text-white rounded-sm px-0.5 leading-none"
                            style={{ fontSize: 8, backgroundColor: "#ef4444", fontWeight: 700 }}
                        >
                            EMP
                        </span>
                    </div>
                )}
            </div>

            {/* Tooltip */}
            <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 hidden group-hover:flex flex-col items-center pointer-events-none"
                style={{ width: 148 }}
            >
                <div className="bg-slate-900 text-white rounded-xl px-3 py-2.5 shadow-2xl text-center border border-slate-700">
                    <p className="font-semibold text-xs leading-tight line-clamp-2">{book.title}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-1">{book.author}</p>
                    <p
                        className="mt-1.5 text-[10px] font-medium rounded-full px-2 py-0.5 inline-block"
                        style={{ backgroundColor: spine.color + "33", color: spine.color }}
                    >
                        {spine.label}
                    </p>
                </div>
                {/* Arrow */}
                <div
                    style={{
                        width: 0,
                        height: 0,
                        borderLeft: "7px solid transparent",
                        borderRight: "7px solid transparent",
                        borderTop: "7px solid #0f172a",
                    }}
                />
            </div>
        </Link>
    );
}

function ShelfRow({ books, isLast, wood }) {
    return (
        <div>
            {/* Books sitting on the shelf */}
            <div className="flex items-end gap-1.5 px-3 pt-3 overflow-x-auto" style={{ minHeight: 116 }}>
                {books.map((b) => (
                    <BookSpine key={b.id} book={b} />
                ))}
                <div className="flex-1 min-w-0" />
            </div>

            {/* Shelf plank */}
            <div
                className="relative mx-0"
                style={{
                    height: 20,
                    background: wood.plank,
                    boxShadow: `inset 0 2px 0 ${wood.plankTop}, inset 0 -1px 0 ${wood.plankBottom}, 0 5px 10px rgba(0,0,0,0.35)`,
                }}
            >
                {/* Wood grain texture */}
                <div
                    className="absolute inset-0"
                    style={{
                        opacity: 0.12,
                        backgroundImage:
                            "repeating-linear-gradient(90deg,transparent,transparent 37px,rgba(0,0,0,0.6) 37px,rgba(0,0,0,0.6) 38px),repeating-linear-gradient(90deg,transparent,transparent 73px,rgba(255,255,255,0.4) 73px,rgba(255,255,255,0.4) 74px)",
                    }}
                />
            </div>

            {/* Gap between shelves */}
            {!isLast && <div style={{ height: 14, background: wood.bg }} />}
        </div>
    );
}

export default function ShelfPage() {
    const [filter, setFilter] = useState("");
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const { theme } = useTheme();
    const wood = WOOD[theme] || WOOD.light;

    useEffect(() => {
        setLoading(true);
        setError("");
        api.get("/shelf", { params: filter ? { filter } : {} })
            .then((r) => setBooks(r.data || []))
            .catch(() => setError("Erro ao carregar a estante. Tente novamente."))
            .finally(() => setLoading(false));
    }, [filter]);

    const shelves = chunkArray(books, BOOKS_PER_SHELF);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-[--color-text]">
                        <i className="fa-solid fa-bookmark text-primary-600 mr-2" />
                        Estante
                    </h1>
                    {books.length > 0 && (
                        <p className="text-xs text-[--color-muted] mt-0.5">
                            {books.length} livro(s) em {shelves.length} prateleira(s)
                        </p>
                    )}
                </div>

                {/* Legenda de status */}
                <div className="flex items-center gap-3 flex-wrap">
                    {Object.entries(STATUS_SPINE).map(([key, { color, label }]) => (
                        <span key={key} className="flex items-center gap-1.5 text-xs text-[--color-muted]">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            {label}
                        </span>
                    ))}
                </div>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={
                            "px-3 py-1.5 text-sm rounded-lg border transition-colors " +
                            (filter === f.key
                                ? "bg-primary-600 text-white border-primary-600"
                                : "border-[--color-border] text-[--color-muted] hover:text-[--color-text] hover:border-primary-400")
                        }
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Erro */}
            {error && (
                <div className="card p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    <i className="fa-solid fa-circle-xmark mr-2" />
                    {error}
                </div>
            )}

            {/* Conteúdo */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
            ) : books.length === 0 && !error ? (
                <div className="card p-14 text-center space-y-3">
                    <div className="text-6xl">📚</div>
                    <p className="text-[--color-muted] font-medium">Nenhum livro encontrado neste filtro.</p>
                    <p className="text-xs text-[--color-muted]">Adicione livros à biblioteca para vê-los na estante.</p>
                </div>
            ) : (
                /* ── Estante ── */
                <div
                    className="rounded-2xl overflow-hidden select-none"
                    style={{
                        background: wood.sidePanel,
                        boxShadow: wood.shadow,
                        padding: "10px 12px 0",
                    }}
                >
                    {/* Topo da moldura */}
                    <div
                        style={{
                            height: 14,
                            marginBottom: 6,
                            borderRadius: "6px 6px 0 0",
                            background: wood.frame,
                            boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,210,140,0.2)",
                        }}
                    />

                    {/* Prateleiras */}
                    {shelves.map((row, i) => (
                        <ShelfRow key={i} books={row} isLast={i === shelves.length - 1} wood={wood} />
                    ))}

                    {/* Painel inferior */}
                    <div
                        style={{
                            height: 22,
                            background: wood.frame,
                            borderRadius: "0 0 6px 6px",
                            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,210,140,0.15)",
                        }}
                    />
                </div>
            )}
        </div>
    );
}
