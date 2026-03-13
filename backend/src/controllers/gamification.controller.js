const db = require("../config/database");
const {
    updateUserProgress,
    recalculateAllProgress,
    getLeaderboard,
    getOrCreateUserProgress,
    markAchievementsViewed,
    getUserStats,
} = require("../services/gamification.service");
const { checkAndUnlockAchievements } = require("../services/achievement.service");
const planFeature = require("../services/planFeature.service");

// GET /api/gamification
const getGamification = (req, res) => {
    const { tenantId, id: userId } = req.user;
    const userName = req.user.full_name || req.user.name || "Leitor";

    // Garante que o progresso existe
    getOrCreateUserProgress(tenantId, userId, userName);

    const userProgress = db
        .prepare(
            `SELECT up.*, u.full_name
             FROM user_progresses up
             JOIN users u ON u.id = up.user_id
             WHERE up.tenant_id = ? AND up.user_id = ?`,
        )
        .get(tenantId, userId);

    if (!userProgress) {
        return res.json({
            userProgress: {
                total_points: 0,
                level: 1,
                books_read: 0,
                total_pages_read: 0,
                current_streak: 0,
                longest_streak: 0,
                yearly_goal: 12,
                reviews_count: 0,
                last_reading_date: null,
            },
            achievements: [],
            lockedAchievements: [],
            recentUnlocked: [],
            stats: {},
            isLimited: false,
        });
    }

    // Corrige streak exibida: se último dia de leitura foi antes de ontem,
    // a sequência está globalmente quebrada — exibe 0 sem gravar no banco agora.
    {
        const todayGc = new Date().toISOString().slice(0, 10);
        const ydGcDate = new Date();
        ydGcDate.setDate(ydGcDate.getDate() - 1);
        const ydGcStr = ydGcDate.toISOString().slice(0, 10);
        if (userProgress.last_reading_date && userProgress.last_reading_date < ydGcStr) {
            userProgress.current_streak = 0;
        }
    }

    const achievements = db
        .prepare(
            `SELECT a.*,
                CASE WHEN ua.id IS NOT NULL THEN 1 ELSE 0 END AS unlocked,
                ua.unlocked_at,
                COALESCE(ua.has_been_viewed, 1) AS has_been_viewed
             FROM achievements a
             LEFT JOIN user_achievements ua
               ON ua.achievement_id = a.id
              AND ua.tenant_id = ?
              AND ua.user_id = ?
             ORDER BY a.rarity DESC, a.requirement ASC`,
        )
        .all(tenantId, userId);

    // Limite por plano
    const plan = req.user.plan || "free";
    const maxVisible = planFeature.getMaxAchievementsVisible(plan);
    const visibleAchievements = isFinite(maxVisible) ? achievements.slice(0, maxVisible) : achievements;
    const lockedAchievements = isFinite(maxVisible) ? achievements.slice(maxVisible) : [];
    const isLimited = lockedAchievements.length > 0;

    const recentUnlocked = achievements
        .filter((a) => a.unlocked)
        .sort((a, b) => (b.unlocked_at || "").localeCompare(a.unlocked_at || ""))
        .slice(0, 5);

    // Estatísticas completas
    const stats = getUserStats(tenantId, userId);

    // Métricas de contexto para a view
    const totalBooksInLibrary = db.prepare("SELECT COUNT(*) as c FROM books WHERE tenant_id = ?").get(tenantId)?.c || 0;

    return res.json({
        userProgress: {
            ...userProgress,
            yearly_books_read: stats.yearlyBooksRead,
            yearly_goal_percent: stats.yearlyGoalPercent,
            level_progress_percent: stats.levelProgressPercent,
            total_books_in_library: totalBooksInLibrary,
            new_achievements: stats.newAchievements,
        },
        achievements: visibleAchievements,
        lockedAchievements,
        isLimited,
        recentUnlocked,
        stats,
    });
};

// PUT /api/gamification/goal
const updateYearlyGoal = (req, res) => {
    const { tenantId, id: userId } = req.user;
    const { yearlyGoal } = req.body;

    const goal = Math.max(1, Math.min(365, parseInt(yearlyGoal) || 0));
    if (!goal) return res.status(400).json({ error: "Meta inválida (1–365)" });

    getOrCreateUserProgress(tenantId, userId);
    db.prepare("UPDATE user_progresses SET yearly_goal = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND user_id = ?").run(
        goal,
        tenantId,
        userId,
    );

    // Reverifica conquistas de meta anual após mudança de meta
    const progress = db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId);
    checkAndUnlockAchievements(tenantId, userId, progress);

    res.json({ success: true, yearlyGoal: goal });
};

// POST /api/gamification/recalculate
// Força recalculação completa de progresso e conquistas do usuário
const recalculateProgress = (req, res) => {
    const { tenantId, id: userId } = req.user;

    try {
        const { progress, newlyUnlocked } = recalculateAllProgress(tenantId, userId);
        return res.json({
            success: true,
            message: `Progresso recalculado! ${newlyUnlocked.length} conquista(s) desbloqueada(s).`,
            progress,
            newlyUnlocked,
        });
    } catch (err) {
        console.error("recalculateProgress:", err);
        return res.status(500).json({ success: false, error: "Erro ao recalcular progresso" });
    }
};

// GET /api/gamification/diagnostic
const diagnosticProgress = (req, res) => {
    const { tenantId, id: userId } = req.user;

    try {
        const userProgress = db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId);
        const userAchievements = db
            .prepare(
                `SELECT a.name, a.icon, a.points, a.rarity, ua.unlocked_at, ua.has_been_viewed
                 FROM user_achievements ua
                 JOIN achievements a ON a.id = ua.achievement_id
                 WHERE ua.tenant_id = ? AND ua.user_id = ?
                 ORDER BY ua.unlocked_at DESC`,
            )
            .all(tenantId, userId);

        const stats = getUserStats(tenantId, userId);
        const plan = req.user.plan || "free";

        return res.json({
            success: true,
            data: {
                userProgress,
                userAchievements,
                stats: {
                    ...stats,
                    plan,
                    maxAchievementsVisible: planFeature.getMaxAchievementsVisible(plan),
                    maxNotesLength: planFeature.getMaxNotesLength(plan),
                    canExportData: planFeature.canExportData(plan),
                    canUseGoogleBooks: planFeature.canUseGoogleBooks(plan),
                    canUseAdvancedStats: planFeature.canUseAdvancedStats(plan),
                },
                timestamp: new Date().toISOString(),
            },
        });
    } catch (err) {
        console.error("diagnosticProgress:", err);
        return res.status(500).json({ error: "Erro no diagnóstico" });
    }
};

// GET /api/gamification/leaderboard
const getLeaderboardController = (req, res) => {
    const { tenantId } = req.user;
    try {
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const leaderboard = getLeaderboard(tenantId, limit);
        return res.json({ leaderboard });
    } catch (err) {
        console.error("getLeaderboard:", err);
        return res.status(500).json({ error: "Erro ao buscar leaderboard" });
    }
};

// POST /api/gamification/mark-viewed
const markViewedController = (req, res) => {
    const { tenantId, id: userId } = req.user;
    try {
        const changed = markAchievementsViewed(tenantId, userId);
        return res.json({ success: true, marked: changed });
    } catch (err) {
        console.error("markViewed:", err);
        return res.status(500).json({ error: "Erro ao marcar conquistas" });
    }
};

module.exports = {
    getGamification,
    updateYearlyGoal,
    recalculateProgress,
    diagnosticProgress,
    getLeaderboard: getLeaderboardController,
    markViewed: markViewedController,
};
