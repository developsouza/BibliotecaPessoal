import { useState, useMemo } from "react";

export function usePagination(totalCount, pageSize = 12) {
    const [page, setPage] = useState(1);

    const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize]);

    const goTo = (p) => setPage(Math.min(Math.max(1, p), totalPages));
    const next = () => goTo(page + 1);
    const prev = () => goTo(page - 1);
    const reset = () => setPage(1);

    return { page, totalPages, goTo, next, prev, reset };
}
