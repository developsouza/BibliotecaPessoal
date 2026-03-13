const db = require("../config/database");

/**
 * Verifica e desbloqueia conquistas para um usuário após atualizar progresso.
 * @param {string} tenantId
 * @param {string} userId
 * @param {object} userProgress - objeto user_progresses atualizado
 * @returns {Array} - novas conquistas desbloqueadas
 */
function checkAndUnlockAchievements(tenantId, userId, userProgress) {
    if (!userProgress) return [];

    const allAchievements = db.prepare("SELECT * FROM achievements ORDER BY requirement ASC").all();

    // Conquistas já desbloqueadas por este usuário
    const unlocked = db
        .prepare("SELECT achievement_id FROM user_achievements WHERE tenant_id = ? AND user_id = ?")
        .all(tenantId, userId)
        .map((r) => r.achievement_id);

    // Contagem de livros na biblioteca do tenant
    const libCount = db.prepare("SELECT COUNT(*) as cnt FROM books WHERE tenant_id = ?").get(tenantId)?.cnt || 0;

    // Contagem de categorias distintas lidas (livros com status = 'read')
    const categoryCount =
        db
            .prepare(
                `SELECT COUNT(DISTINCT b.category_id) as cnt
                 FROM reading_progresses rp
                 JOIN books b ON b.id = rp.book_id
                 WHERE rp.tenant_id = ? AND rp.user_id = ? AND rp.end_date IS NOT NULL
                   AND b.category_id IS NOT NULL`,
            )
            .get(tenantId, userId)?.cnt || 0;

    // Avaliações do usuário: leituras com notas ou rating > 0
    const reviewCount =
        db
            .prepare(
                `SELECT COUNT(*) as cnt FROM reading_progresses
                 WHERE tenant_id = ? AND user_id = ?
                   AND (notes IS NOT NULL AND notes != '' OR rating > 0)`,
            )
            .get(tenantId, userId)?.cnt || 0;

    // Percentual da meta anual (0–100)
    const yearlyGoal = userProgress.yearly_goal || 12;
    const booksRead = userProgress.books_read || 0;
    const yearlyGoalPercent = yearlyGoal > 0 ? Math.min(100, Math.round((booksRead / yearlyGoal) * 100)) : 0;

    const getValue = (type) => {
        switch (type) {
            case "books_read":
                return booksRead;
            case "books_in_library":
                return libCount;
            case "reading_streak":
                return userProgress.current_streak || 0;
            case "pages_read":
                return userProgress.total_pages_read || 0;
            case "genre_explorer":
                return categoryCount;
            case "reviewer":
                return reviewCount;
            case "yearly_goal":
                return yearlyGoalPercent; // requisito em %
            default:
                return 0;
        }
    };

    const newlyUnlocked = [];

    for (const achievement of allAchievements) {
        if (unlocked.includes(achievement.id)) continue;

        const value = getValue(achievement.type);
        if (value >= achievement.requirement) {
            db.prepare(
                `INSERT INTO user_achievements (tenant_id, user_id, achievement_id, has_been_viewed)
                 VALUES (?, ?, ?, 0)`,
            ).run(tenantId, userId, achievement.id);

            // Somar pontos da conquista ao usuário e recalcular nível
            // CAST garante divisão inteira em SQLite (evita float como 1.2)
            db.prepare(
                `UPDATE user_progresses
                 SET total_points = total_points + ?,
                     level        = CAST((total_points + ?) / 100 AS INTEGER) + 1
                 WHERE tenant_id = ? AND user_id = ?`,
            ).run(achievement.points, achievement.points, tenantId, userId);

            newlyUnlocked.push(achievement);
        }
    }

    return newlyUnlocked;
}

module.exports = { checkAndUnlockAchievements };
