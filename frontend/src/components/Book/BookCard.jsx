import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import StarRating from "../UI/StarRating";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

// URLs externas (Google Books) usadas diretamente; caminhos locais recebem prefixo do servidor.
function coverSrc(path) {
    if (!path) return "/images/no-cover.svg";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return API_BASE + path;
}

export default function BookCard({ book, onEdit, onDelete }) {
    const cover = coverSrc(book.coverImagePath);

    return (
        <div className="card group flex flex-col overflow-hidden hover:shadow-md transition-shadow">
            {/* Capa */}
            <div className="relative aspect-[2/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <img
                    src={cover}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                        e.target.src = "/images/no-cover.svg";
                    }}
                />
                {/* Status badge overlay */}
                <div className="absolute top-2 left-2">
                    <StatusBadge status={book.status} />
                </div>
                {/* Featured star */}
                {book.isFeatured && (
                    <div className="absolute top-2 right-2">
                        <span className="bg-yellow-400 text-yellow-900 rounded-full px-2 py-0.5 text-xs font-bold">⭐ Destaque</span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-3 flex flex-col flex-1 gap-1.5">
                <Link
                    to={`/books/${book.id}`}
                    className="font-semibold text-[--color-text] text-sm line-clamp-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                    {book.title}
                </Link>
                <p className="text-[--color-muted] text-xs line-clamp-1">{book.author}</p>

                {book.category && (
                    <div className="flex items-center gap-1 mt-0.5">
                        <span
                            className="inline-block w-2.5 h-2.5 rounded-full border border-white/30"
                            style={{ backgroundColor: book.category.color }}
                        />
                        <span className="text-xs text-[--color-muted] truncate">{book.category.name}</span>
                    </div>
                )}

                {book.rating > 0 && <StarRating value={book.rating} readOnly size="sm" />}

                {/* Actions */}
                <div className="flex gap-1.5 mt-auto pt-2">
                    <Link to={`/books/${book.id}`} className="btn btn-secondary btn-sm flex-1 justify-center">
                        <i className="fa-solid fa-eye text-xs" />
                    </Link>
                    {onEdit && (
                        <button onClick={() => onEdit(book)} className="btn btn-secondary btn-sm flex-1 justify-center">
                            <i className="fa-solid fa-pen text-xs" />
                        </button>
                    )}
                    {onDelete && (
                        <button onClick={() => onDelete(book)} className="btn btn-danger btn-sm flex-1 justify-center">
                            <i className="fa-solid fa-trash text-xs" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
