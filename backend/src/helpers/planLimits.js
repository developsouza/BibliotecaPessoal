// ============================================================
// PLAN FEATURES — definições de recursos por plano
// ============================================================

const PLAN_FEATURES = {
    free: {
        planKey: "free",
        planLabel: "Free",
        maxBooks: 25,
        maxStorageMB: 25,
        monthlyPrice: 0,
        trialDays: 0,
        canExportData: false,
        canUseGoogleBooksApi: false,
        canUseAdvancedStats: false,
        maxAchievementsVisible: 5,
        maxReadingHistoryVisible: 10,
        maxNotesLength: 500,
        canViewStreakHistory: false,
        canViewLeaderboard: false,
    },
    premium: {
        planKey: "premium",
        planLabel: "Premium",
        maxBooks: 100,
        maxStorageMB: 100,
        monthlyPrice: 9.9,
        trialDays: 7,
        canExportData: true,
        canUseGoogleBooksApi: true,
        canUseAdvancedStats: false,
        maxAchievementsVisible: Infinity,
        maxReadingHistoryVisible: Infinity,
        maxNotesLength: 3000,
        canViewStreakHistory: true,
        canViewLeaderboard: true,
    },
    pro: {
        planKey: "pro",
        planLabel: "Pro",
        maxBooks: 99999, // "ilimitado"
        maxStorageMB: 5000,
        monthlyPrice: 19.9,
        trialDays: 14,
        canExportData: true,
        canUseGoogleBooksApi: true,
        canUseAdvancedStats: true,
        maxAchievementsVisible: Infinity,
        maxReadingHistoryVisible: Infinity,
        maxNotesLength: 3000,
        canViewStreakHistory: true,
        canViewLeaderboard: true,
    },
};

// ============================================================
// SUBSCRIPTION STATUS
// ============================================================

const SubscriptionStatus = {
    Trial: "trial",
    Active: "active",
    Suspended: "suspended",
    Cancelled: "cancelled",
    Expired: "expired",
    PastDue: "past_due",
    Incomplete: "incomplete",
};

const SubscriptionStatusLabel = {
    trial: "Trial",
    active: "Ativa",
    suspended: "Suspensa",
    cancelled: "Cancelada",
    expired: "Expirada",
    past_due: "Aguardando Pagamento",
    incomplete: "Incompleta",
};

// ============================================================
// PAYMENT STATUS
// ============================================================

const PaymentStatus = {
    Pending: "pending",
    Processing: "processing",
    Succeeded: "succeeded",
    Failed: "failed",
    Cancelled: "cancelled",
    Refunded: "refunded",
};

// ============================================================
// MAPEAMENTO STRIPE → SISTEMA
// ============================================================

function mapStripeStatus(stripeStatus) {
    const map = {
        trialing: SubscriptionStatus.Trial,
        active: SubscriptionStatus.Active,
        past_due: SubscriptionStatus.PastDue,
        canceled: SubscriptionStatus.Cancelled,
        unpaid: SubscriptionStatus.Suspended,
        incomplete: SubscriptionStatus.Incomplete,
        incomplete_expired: SubscriptionStatus.Expired,
    };
    return map[stripeStatus] ?? SubscriptionStatus.Active;
}

// ============================================================
// OBTER PRICE ID DO STRIPE POR PLANO
// ============================================================

function getStripePriceId(plan) {
    switch (plan) {
        case "premium":
            return process.env.STRIPE_PRICE_PREMIUM;
        case "pro":
            return process.env.STRIPE_PRICE_PRO;
        default:
            throw new Error(`Plano inválido para pagamento: ${plan}`);
    }
}

// ============================================================
// HELPER: plano inativo (sem assinatura ativa)
// ============================================================

function isSubscriptionInactive(status) {
    return [SubscriptionStatus.Cancelled, SubscriptionStatus.Expired, SubscriptionStatus.Incomplete].includes(status);
}

module.exports = {
    PLAN_FEATURES,
    SubscriptionStatus,
    SubscriptionStatusLabel,
    PaymentStatus,
    mapStripeStatus,
    getStripePriceId,
    isSubscriptionInactive,
};
