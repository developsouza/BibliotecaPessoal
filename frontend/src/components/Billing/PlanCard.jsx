export default function PlanCard({ plan, currentPlan, onSelect, loading }) {
    const isCurrent = currentPlan === plan.planKey;
    const isFree = plan.planKey === "free";
    const isPopular = plan.planKey === "premium";
    const isPro = plan.planKey === "pro";

    const borderClass = isPopular
        ? "border-primary-400 dark:border-primary-600 ring-2 ring-primary-200 dark:ring-primary-900"
        : "border-[--color-border]";

    const badgeClass = isPopular ? "bg-primary-600" : isPro ? "bg-violet-600" : "bg-slate-500";

    const btnClass = isCurrent
        ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-default"
        : isFree
          ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
          : isPopular
            ? "bg-primary-600 hover:bg-primary-700 text-white"
            : "bg-violet-600 hover:bg-violet-700 text-white";

    function handleClick() {
        if (isCurrent || isFree || loading) return;
        onSelect(plan.planKey);
    }

    return (
        <div className={`relative bg-[--color-card] border-2 ${borderClass} rounded-2xl p-6 flex flex-col gap-4`}>
            {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-xs font-bold bg-primary-600 text-white rounded-full">
                    ⭐ POPULAR
                </span>
            )}

            <div>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[--color-text]">{plan.planLabel}</h3>
                    {isCurrent && <span className={`px-2 py-0.5 text-xs font-medium rounded-full text-white ${badgeClass}`}>Plano Atual</span>}
                </div>
                <p className="text-2xl font-extrabold text-[--color-text] mt-1">
                    {plan.monthlyPrice > 0 ? (
                        <>
                            R$ <span>{plan.monthlyPrice.toFixed(2).replace(".", ",")}</span>
                            <span className="text-sm font-normal text-[--color-muted]">/mês</span>
                        </>
                    ) : (
                        "Grátis"
                    )}
                </p>
                {plan.trialDays > 0 && !isCurrent && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5">{plan.trialDays} dias grátis</p>
                )}
            </div>

            <ul className="space-y-1.5 flex-1">
                {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[--color-text]">
                        <i className="fa-solid fa-check text-green-500 w-4 shrink-0" />
                        {f}
                    </li>
                ))}
                {plan.notIncluded.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[--color-muted]">
                        <i className="fa-solid fa-xmark text-gray-400 w-4 shrink-0" />
                        {f}
                    </li>
                ))}
            </ul>

            <button
                onClick={handleClick}
                disabled={isCurrent || loading}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${btnClass} disabled:opacity-60 disabled:cursor-not-allowed`}
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Processando...
                    </span>
                ) : isCurrent ? (
                    "Plano Atual"
                ) : isFree ? (
                    "Cancele para voltar ao Free"
                ) : (
                    `Assinar ${plan.planLabel}`
                )}
            </button>
        </div>
    );
}
