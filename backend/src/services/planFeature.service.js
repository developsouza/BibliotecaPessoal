/**
 * planFeature.service.js
 * Centraliza todas as regras de negócio de features por plano.
 *
 * Planos: free | premium | pro | master
 */

const PLAN_LIMITS = {
    free: {
        maxBooks: 25,
        maxStorageMB: 25,
        canExportData: false,
        canUseGoogleBooks: false,
        canUseAdvancedStats: false,
        maxAchievementsVisible: 5,
        maxNotesLength: 500,
        maxReadingHistoryVisible: 10,
        canViewStreakHistory: false,
        canViewLeaderboard: false,
    },
    premium: {
        maxBooks: 100,
        maxStorageMB: 100,
        canExportData: true,
        canUseGoogleBooks: true,
        canUseAdvancedStats: false,
        maxAchievementsVisible: Infinity,
        maxNotesLength: 3000,
        maxReadingHistoryVisible: Infinity,
        canViewStreakHistory: true,
        canViewLeaderboard: true,
    },
    pro: {
        maxBooks: Infinity,
        maxStorageMB: 5 * 1024, // 5 GB
        canExportData: true,
        canUseGoogleBooks: true,
        canUseAdvancedStats: true,
        maxAchievementsVisible: Infinity,
        maxNotesLength: 3000,
        maxReadingHistoryVisible: Infinity,
        canViewStreakHistory: true,
        canViewLeaderboard: true,
    },
    master: {
        maxBooks: Infinity,
        maxStorageMB: Infinity,
        canExportData: true,
        canUseGoogleBooks: true,
        canUseAdvancedStats: true,
        maxAchievementsVisible: Infinity,
        maxNotesLength: Infinity,
        maxReadingHistoryVisible: Infinity,
        canViewStreakHistory: true,
        canViewLeaderboard: true,
    },
};

/**
 * Retorna os limites de um plano (fallback para free se desconhecido).
 * @param {string} plan
 */
function getLimits(plan) {
    return PLAN_LIMITS[plan?.toLowerCase()] || PLAN_LIMITS.free;
}

/**
 * Verifica se o plano pode exportar dados (CSV / Excel / PDF).
 */
function canExportData(plan) {
    return getLimits(plan).canExportData;
}

/**
 * Verifica se o plano pode usar a integração com o Google Books.
 */
function canUseGoogleBooks(plan) {
    return getLimits(plan).canUseGoogleBooks;
}

/**
 * Verifica se o plano tem acesso às estatísticas avançadas.
 */
function canUseAdvancedStats(plan) {
    return getLimits(plan).canUseAdvancedStats;
}

/**
 * Quantas conquistas o plano pode exibir (Free=5, resto=Infinity).
 */
function getMaxAchievementsVisible(plan) {
    return getLimits(plan).maxAchievementsVisible;
}

/**
 * Quantidade máxima de caracteres nas notas de leitura.
 */
function getMaxNotesLength(plan) {
    return getLimits(plan).maxNotesLength;
}

/**
 * Quantidade máxima de registros no histórico de leitura (Free=10).
 */
function getMaxReadingHistoryVisible(plan) {
    return getLimits(plan).maxReadingHistoryVisible;
}

/**
 * Se o plano pode ver o histórico de streak.
 */
function canViewStreakHistory(plan) {
    return getLimits(plan).canViewStreakHistory;
}

/**
 * Se o plano pode acessar o ranking/leaderboard (Free não pode).
 */
function canViewLeaderboard(plan) {
    return getLimits(plan).canViewLeaderboard ?? false;
}

/**
 * Retorna o preço mensal formatado em R$.
 */
function getMonthlyPrice(plan) {
    const prices = { free: 0, premium: 9.9, pro: 19.9, master: 0 };
    return prices[plan?.toLowerCase()] ?? 0;
}

/**
 * Retorna o período de trial em dias.
 */
function getTrialDays(plan) {
    const trials = { free: 0, premium: 7, pro: 14, master: 0 };
    return trials[plan?.toLowerCase()] ?? 0;
}

/**
 * Mensagem de upgrade formatada para ser enviada ao cliente.
 */
function upgradeMessage(plan, featureName) {
    const planName = plan?.charAt(0).toUpperCase() + plan?.slice(1);
    return `Esta funcionalidade (${featureName}) não está disponível no plano ${planName}. Faça upgrade para acessar.`;
}

/**
 * Middleware Express: bloqueia acesso se o plano não suporta a feature.
 * Uso: router.get('/export', auth, requirePlanFeature('canExportData', 'Exportação'), ctrl.export)
 *
 * @param {'canExportData'|'canUseGoogleBooks'|'canUseAdvancedStats'} featureKey
 * @param {string} featureName - Nome legível da feature (para mensagem de erro)
 */
function requirePlanFeature(featureKey, featureName) {
    return (req, res, next) => {
        const plan = req.user?.plan || "free";
        const limits = getLimits(plan);
        if (limits[featureKey]) return next();

        const isJson =
            (req.headers["x-requested-with"] || "").toLowerCase() === "xmlhttprequest" || (req.headers["accept"] || "").includes("application/json");

        if (isJson) {
            return res.status(403).json({
                success: false,
                message: upgradeMessage(plan, featureName),
                requiresUpgrade: true,
                upgradeUrl: "/billing",
            });
        }

        return res.status(403).json({
            success: false,
            message: upgradeMessage(plan, featureName),
            requiresUpgrade: true,
            upgradeUrl: "/billing",
        });
    };
}

module.exports = {
    getLimits,
    canExportData,
    canUseGoogleBooks,
    canUseAdvancedStats,
    getMaxAchievementsVisible,
    getMaxNotesLength,
    getMaxReadingHistoryVisible,
    canViewStreakHistory,
    canViewLeaderboard,
    getMonthlyPrice,
    getTrialDays,
    upgradeMessage,
    requirePlanFeature,
};
