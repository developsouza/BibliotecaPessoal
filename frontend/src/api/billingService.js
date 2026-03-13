import api from "./axios";

const billingService = {
    // GET /api/billing — carrega subscription + pagamentos
    getPortal: (checkoutSuccess = false) =>
        api.get("/billing", {
            params: checkoutSuccess ? { checkoutSuccess: true } : {},
        }),

    // POST /api/billing/upgrade — fazer upgrade de plano
    upgrade: (plan) => api.post("/billing/upgrade", { plan }),

    // POST /api/billing/cancel — cancelar assinatura
    cancel: (immediately = false) => api.post("/billing/cancel", { immediately }),

    // POST /api/billing/reactivate — reativar assinatura
    reactivate: () => api.post("/billing/reactivate"),

    // GET /api/billing/portal — obter URL do Stripe Customer Portal
    getStripePortalUrl: () => api.get("/billing/portal"),
};

export default billingService;

// ============================================================
// Constantes de plano (mirror do backend)
// ============================================================

export const PLAN_FEATURES = {
    free: {
        planKey: "free",
        planLabel: "Free",
        maxBooks: 25,
        maxStorageMB: 25,
        monthlyPrice: 0,
        trialDays: 0,
        features: ["Até 25 livros", "25 MB de armazenamento", "Leitura e empréstimos", "Gamificação básica", "Estante visual"],
        notIncluded: ["Google Books import", "Estatísticas avançadas", "Exportar PDF/Excel", "Suporte prioritário"],
    },
    premium: {
        planKey: "premium",
        planLabel: "Premium",
        maxBooks: 100,
        maxStorageMB: 100,
        monthlyPrice: 9.9,
        trialDays: 7,
        features: ["Até 100 livros", "100 MB de armazenamento", "Tudo do Free", "Google Books import", "Exportar PDF/Excel"],
        notIncluded: ["Estatísticas avançadas", "Suporte prioritário"],
    },
    pro: {
        planKey: "pro",
        planLabel: "Pro",
        maxBooks: 99999,
        maxStorageMB: 5000,
        monthlyPrice: 19.9,
        trialDays: 14,
        features: ["Livros ilimitados", "5 GB de armazenamento", "Tudo do Premium", "Estatísticas avançadas", "Suporte prioritário"],
        notIncluded: [],
    },
};

export const SUBSCRIPTION_STATUS_LABEL = {
    trial: "Trial",
    active: "Ativa",
    suspended: "Suspensa",
    cancelled: "Cancelada",
    expired: "Expirada",
    past_due: "Aguardando Pagamento",
    incomplete: "Incompleta",
};

export const PAYMENT_STATUS_LABEL = {
    pending: "Pendente",
    processing: "Processando",
    succeeded: "Pago",
    failed: "Falhou",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
};
