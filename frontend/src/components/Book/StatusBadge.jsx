const statusMap = {
    want_to_read: { label: "Quero Ler", cls: "badge-want", icon: "fa-bookmark" },
    reading: { label: "Lendo", cls: "badge-reading", icon: "fa-book-open" },
    read: { label: "Lido", cls: "badge-read", icon: "fa-check" },
    paused: { label: "Pausado", cls: "badge-paused", icon: "fa-pause" },
};

export default function StatusBadge({ status }) {
    const s = statusMap[status] || { label: status, cls: "badge bg-slate-100 text-slate-600", icon: "fa-circle" };
    return (
        <span className={s.cls}>
            <i className={`fa-solid ${s.icon} text-[10px]`} />
            {s.label}
        </span>
    );
}
