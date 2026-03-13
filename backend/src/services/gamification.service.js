const db = require("../config/database");

/**
 * Retorna ou cria o registro de progresso do usuário.
 */
function getOrCreateUserProgress(tenantId, userId, userName = "Leitor") {
    let progress = db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId);
    if (!progress) {
        db.prepare(`INSERT OR IGNORE INTO user_progresses (tenant_id, user_id, user_name) VALUES (?, ?, ?)`).run(tenantId, userId, userName);
        progress = db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId);
    }
    return progress;
}

/**
 * Recalcula e persiste métricas do usuário (streak, booksRead, pagesRead, reviewsCount).
 * Pontos NÃO são adicionados aqui — vêm exclusivamente das conquistas desbloqueadas.
 *
 * @param {string} tenantId
 * @param {string} userId
 * @param {object} opts - { pagesRead, bookId, date }
 * @returns {object|null} progresso atualizado
 */
function updateUserProgress(tenantId, userId, { pagesRead = 0, bookId = null, date = null } = {}) {
    const today = date || new Date().toISOString().slice(0, 10);
    // Garante que o registro exista (cria se necessário)
    getOrCreateUserProgress(tenantId, userId);
    const progress = db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId);
    if (!progress) return null;

    // ── Streak ──────────────────────────────────────────────
    let newStreak = progress.current_streak || 0;
    const last = progress.last_reading_date;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Ignora datas retroativas para não quebrar a sequência atual.
    // Se a atividade registrada é anterior ao último dia de leitura,
    // apenas contabiliza páginas/livros sem tocar no streak.
    if (!last || today >= last) {
        if (!last) {
            // Primeira leitura registrada
            newStreak = 1;
        } else if (today === last) {
            // Já houve leitura registrada hoje — mantém streak sem mudança
        } else if (last === yesterdayStr) {
            // Leitura de ontem: incrementa sequência
            newStreak += 1;
        } else {
            // Gap > 1 dia: reinicia sequência
            newStreak = 1;
        }
    }
    const newLongest = Math.max(progress.longest_streak || 0, newStreak);
    // last_reading_date nunca regride para uma data anterior ao que já está no banco
    const newLastDate = !last || today > last ? today : last;

    // ── Métricas recalculadas do banco ───────────────────────
    const booksRead =
        db
            .prepare("SELECT COUNT(*) as cnt FROM reading_progresses WHERE tenant_id = ? AND user_id = ? AND end_date IS NOT NULL")
            .get(tenantId, userId)?.cnt || 0;

    const totalPagesRead =
        db
            .prepare(
                `SELECT COALESCE(SUM(
                   CASE
                     WHEN rp.end_date IS NOT NULL THEN COALESCE(b.pages, 0)
                     ELSE COALESCE(rp.current_page, 0)
                   END
                 ), 0) AS total
             FROM reading_progresses rp
             JOIN books b ON b.id = rp.book_id
             WHERE rp.tenant_id = ? AND rp.user_id = ?`,
            )
            .get(tenantId, userId)?.total || 0;

    const reviewsCount =
        db
            .prepare(
                `SELECT COUNT(*) as cnt FROM reading_progresses
             WHERE tenant_id = ? AND user_id = ?
               AND (notes IS NOT NULL AND notes != '' OR rating > 0)`,
            )
            .get(tenantId, userId)?.cnt || 0;

    // Nível calculado a partir dos pontos atuais — pontos não são alterados aqui
    const currentPoints = progress.total_points || 0;
    const newLevel = Math.floor(currentPoints / 100) + 1;

    db.prepare(
        `UPDATE user_progresses
        SET current_streak    = ?,
            longest_streak    = ?,
            last_reading_date = ?,
            total_pages_read  = ?,
            level             = ?,
            books_read        = ?,
            reviews_count     = ?,
            updated_at        = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND user_id = ?`,
    ).run(newStreak, newLongest, newLastDate, totalPagesRead, newLevel, booksRead, reviewsCount, tenantId, userId);

    // ── Registra atividade de leitura (feeding reading_activities) ────────
    if (pagesRead > 0) {
        const upRow = db.prepare("SELECT id FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId);
        if (upRow) {
            const actExisting = db
                .prepare(
                    `SELECT id FROM reading_activities
                     WHERE user_progress_id = ? AND activity_date = ?
                       AND COALESCE(book_id, -1) = COALESCE(?, -1)`,
                )
                .get(upRow.id, today, bookId || null);
            if (actExisting) {
                db.prepare("UPDATE reading_activities SET pages_read = pages_read + ? WHERE id = ?").run(pagesRead, actExisting.id);
            } else {
                db.prepare(
                    "INSERT INTO reading_activities (tenant_id, user_progress_id, book_id, activity_date, pages_read) VALUES (?, ?, ?, ?, ?)",
                ).run(tenantId, upRow.id, bookId || null, today, pagesRead);
            }
        }
    }

    return db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId);
}

/**
 * Recalculação completa do zero:
 * 1. Remove todas as conquistas do usuário
 * 2. Zera pontos e recalcula métricas
 * 3. Re-executa verificação de conquistas (que acumulará pontos)
 */
function recalculateAllProgress(tenantId, userId) {
    const { checkAndUnlockAchievements } = require("./achievement.service");

    db.prepare("DELETE FROM user_achievements WHERE tenant_id = ? AND user_id = ?").run(tenantId, userId);

    const booksRead =
        db
            .prepare("SELECT COUNT(*) as cnt FROM reading_progresses WHERE tenant_id = ? AND user_id = ? AND end_date IS NOT NULL")
            .get(tenantId, userId)?.cnt || 0;

    const totalPagesRead =
        db
            .prepare(
                `SELECT COALESCE(SUM(
                   CASE
                     WHEN rp.end_date IS NOT NULL THEN COALESCE(b.pages, 0)
                     ELSE COALESCE(rp.current_page, 0)
                   END
                 ), 0) AS total
             FROM reading_progresses rp
             JOIN books b ON b.id = rp.book_id
             WHERE rp.tenant_id = ? AND rp.user_id = ?`,
            )
            .get(tenantId, userId)?.total || 0;

    const reviewsCount =
        db
            .prepare(
                `SELECT COUNT(*) as cnt FROM reading_progresses
             WHERE tenant_id = ? AND user_id = ?
               AND (notes IS NOT NULL AND notes != '' OR rating > 0)`,
            )
            .get(tenantId, userId)?.cnt || 0;

    const existing = db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId);
    if (!existing) {
        db.prepare(
            `INSERT OR IGNORE INTO user_progresses (tenant_id, user_id, books_read, total_pages_read, reviews_count, total_points, level)
             VALUES (?, ?, ?, ?, ?, 0, 1)`,
        ).run(tenantId, userId, booksRead, totalPagesRead, reviewsCount);
    } else {
        db.prepare(
            `UPDATE user_progresses
             SET books_read = ?, total_pages_read = ?, reviews_count = ?,
                 total_points = 0, level = 1, updated_at = CURRENT_TIMESTAMP
             WHERE tenant_id = ? AND user_id = ?`,
        ).run(booksRead, totalPagesRead, reviewsCount, tenantId, userId);
    }

    const progress = db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId);
    const newlyUnlocked = checkAndUnlockAchievements(tenantId, userId, progress);

    return {
        progress: db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId),
        newlyUnlocked,
    };
}

/**
 * Retorna o leaderboard do tenant (top N usuários por pontos).
 */
function getLeaderboard(tenantId, limit = 10) {
    return db
        .prepare(
            `SELECT up.user_id, up.user_name, up.total_points, up.level,
                up.books_read, up.current_streak, up.longest_streak,
                u.full_name
             FROM user_progresses up
             JOIN users u ON u.id = up.user_id
             WHERE up.tenant_id = ?
             ORDER BY up.total_points DESC, up.books_read DESC
             LIMIT ?`,
        )
        .all(tenantId, limit);
}

/**
 * Marca todas as conquistas não visualizadas do usuário como vistas.
 */
function markAchievementsViewed(tenantId, userId) {
    const result = db
        .prepare(
            `UPDATE user_achievements
             SET has_been_viewed = 1
             WHERE tenant_id = ? AND user_id = ? AND has_been_viewed = 0`,
        )
        .run(tenantId, userId);
    return result.changes;
}

/**
 * Retorna estatísticas detalhadas do usuário para exibição na UI.
 */
function getUserStats(tenantId, userId) {
    const progress = db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId);
    if (!progress) return {};

    // Streak efetiva: se o último dia de leitura foi antes de ontem, a
    // sequência está quebrada — retorna 0 sem alterar o banco agora.
    const todayGs = new Date().toISOString().slice(0, 10);
    const ydGsDate = new Date();
    ydGsDate.setDate(ydGsDate.getDate() - 1);
    const ydGsStr = ydGsDate.toISOString().slice(0, 10);
    const effectiveStreak = progress.last_reading_date && progress.last_reading_date < ydGsStr ? 0 : progress.current_streak || 0;

    const avgRating =
        db.prepare("SELECT AVG(rating) as avg FROM reading_progresses WHERE tenant_id = ? AND user_id = ? AND rating > 0").get(tenantId, userId)
            ?.avg || 0;

    const unlockedCount =
        db.prepare("SELECT COUNT(*) as cnt FROM user_achievements WHERE tenant_id = ? AND user_id = ?").get(tenantId, userId)?.cnt || 0;

    const newCount =
        db.prepare("SELECT COUNT(*) as cnt FROM user_achievements WHERE tenant_id = ? AND user_id = ? AND has_been_viewed = 0").get(tenantId, userId)
            ?.cnt || 0;

    const yearlyBooksRead =
        db
            .prepare(
                `SELECT COUNT(*) as c FROM reading_progresses
             WHERE tenant_id = ? AND user_id = ? AND end_date IS NOT NULL
               AND strftime('%Y', end_date) = strftime('%Y', 'now')`,
            )
            .get(tenantId, userId)?.c || 0;

    const yearlyGoal = progress.yearly_goal || 12;
    const yearlyGoalPercent = yearlyGoal > 0 ? Math.min(100, Math.round((yearlyBooksRead / yearlyGoal) * 100)) : 0;

    const pointsPerLevel = 100;
    const currentLevelPoints = (progress.level - 1) * pointsPerLevel;
    const levelProgressPercent = Math.min(100, Math.round(((progress.total_points - currentLevelPoints) / pointsPerLevel) * 100));

    return {
        booksRead: progress.books_read,
        totalPagesRead: progress.total_pages_read,
        currentStreak: effectiveStreak,
        longestStreak: progress.longest_streak,
        reviewsCount: progress.reviews_count,
        averageRating: Math.round((avgRating || 0) * 10) / 10,
        totalPoints: progress.total_points,
        level: progress.level,
        levelProgressPercent,
        yearlyGoal,
        yearlyBooksRead,
        yearlyGoalPercent,
        unlockedAchievements: unlockedCount,
        newAchievements: newCount,
    };
}

module.exports = {
    getOrCreateUserProgress,
    updateUserProgress,
    recalculateAllProgress,
    getLeaderboard,
    markAchievementsViewed,
    getUserStats,
};
