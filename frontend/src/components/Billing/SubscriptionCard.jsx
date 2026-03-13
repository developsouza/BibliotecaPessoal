import { SUBSCRIPTION_STATUS_LABEL, PLAN_FEATURES } from "../../api/billingService";

const STATUS_COLORS = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    trial: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    expired: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
    past_due: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    suspended: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    incomplete: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
};

const PLAN_COLORS = {
    free: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
    premium: "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300",
    pro: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

function fmt(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default function SubscriptionCard({ subscription, onCancel, onReactivate, onManage, onUpgrade }) {
    if (!subscription) return null;

    const plan = PLAN_FEATURES[subscription.plan] || PLAN_FEATURES.free;
    const isCancelScheduled = subscription.cancelAtPeriodEnd;
    const isTrialActive = subscription.isTrialPeriod && subscription.trialEnd && new Date(subscription.trialEnd) > new Date();

    return (
        <div className="bg-[--color-card] border border-[--color-border] rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-[--color-text]">Detalhes da Assinatura</h2>
                <div className="flex gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[subscription.plan] || PLAN_COLORS.free}`}>
                        {plan.planLabel}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[subscription.status] || STATUS_COLORS.expired}`}>
                        {SUBSCRIPTION_STATUS_LABEL[subscription.status] || subscription.status}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="text-[--color-muted]">Valor Mensal</p>
                    <p className="font-semibold text-[--color-text]">
                        {subscription.monthlyAmount > 0 ? `R$ ${Number(subscription.monthlyAmount).toFixed(2).replace(".", ",")}` : "Grátis"}
                    </p>
                </div>
                <div>
                    <p className="text-[--color-muted]">Período Atual</p>
                    <p className="font-medium text-[--color-text]">
                        {fmt(subscription.currentPeriodStart)} – {fmt(subscription.currentPeriodEnd)}
                    </p>
                </div>
                {isTrialActive && (
                    <div>
                        <p className="text-[--color-muted]">Trial termina em</p>
                        <p className="font-medium text-blue-600 dark:text-blue-400">{fmt(subscription.trialEnd)}</p>
                    </div>
                )}
            </div>

            {isCancelScheduled && (
                <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm text-orange-700 dark:text-orange-300">
                    <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" />
                    <span>
                        Cancelamento agendado para <strong>{fmt(subscription.currentPeriodEnd)}</strong>. Você ainda tem acesso até lá.
                    </span>
                </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
                {onUpgrade && !isCancelScheduled && (
                    <button
                        onClick={onUpgrade}
                        className="px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                    >
                        <i className="fa-solid fa-arrow-up mr-1.5" />
                        Upgrade de Plano
                    </button>
                )}

                {onManage && (
                    <button
                        onClick={onManage}
                        className="px-4 py-2 text-sm font-medium bg-[--color-bg] border border-[--color-border] text-[--color-text] hover:bg-[--color-border] rounded-lg transition-colors"
                    >
                        <i className="fa-brands fa-stripe mr-1.5" />
                        Gerenciar Pagamento
                    </button>
                )}

                {isCancelScheduled && onReactivate ? (
                    <button
                        onClick={onReactivate}
                        className="px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                        <i className="fa-solid fa-rotate-right mr-1.5" />
                        Reativar Assinatura
                    </button>
                ) : (
                    onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-colors"
                        >
                            <i className="fa-solid fa-xmark mr-1.5" />
                            Cancelar Assinatura
                        </button>
                    )
                )}
            </div>
        </div>
    );
}
