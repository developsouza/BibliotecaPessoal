export default function StarRating({ value = 0, onChange, readOnly = false, size = "md" }) {
    const sizes = { sm: "text-sm", md: "text-base", lg: "text-xl" };

    return (
        <div className={`flex gap-0.5 ${sizes[size]}`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange?.(star === value ? 0 : star)}
                    className={`
            transition-colors duration-100
            ${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110 transition-transform"}
            ${star <= value ? "text-yellow-400" : "text-slate-300 dark:text-slate-600"}
          `}
                >
                    <i className="fa-solid fa-star" />
                </button>
            ))}
        </div>
    );
}
