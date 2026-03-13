export default function Pagination({ page, totalPages, onPageChange }) {
    if (totalPages <= 1) return null;

    const pages = [];
    const delta = 2;
    let left = page - delta;
    let right = page + delta + 1;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= left && i < right)) {
            pages.push(i);
        }
    }

    const withEllipsis = [];
    let prev = null;
    for (const p of pages) {
        if (prev !== null && p - prev > 1) withEllipsis.push("...");
        withEllipsis.push(p);
        prev = p;
    }

    return (
        <nav className="flex items-center justify-center gap-1 mt-6" aria-label="Paginação">
            <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className="btn btn-secondary btn-sm">
                <i className="fa-solid fa-chevron-left text-xs" />
            </button>

            {withEllipsis.map((p, i) =>
                p === "..." ? (
                    <span key={`e${i}`} className="px-2 text-[--color-muted]">
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onPageChange(p)}
                        className={`btn btn-sm min-w-[2rem] ${p === page ? "btn-primary" : "btn-secondary"}`}
                    >
                        {p}
                    </button>
                ),
            )}

            <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages} className="btn btn-secondary btn-sm">
                <i className="fa-solid fa-chevron-right text-xs" />
            </button>
        </nav>
    );
}
