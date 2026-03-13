const db = require("../config/database");
const { analyzeReadingIntegrity } = require("../services/anomaly.service");

const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ─────────────────────────────────────────────────────────────
// Helper: obtém o registro user_progresses do usuário atual
// ─────────────────────────────────────────────────────────────
function getUserProgress(userId, tenantId) {
    return (
        db.prepare("SELECT * FROM user_progresses WHERE user_id = ? AND tenant_id = ?").get(userId, tenantId) ||
        db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? LIMIT 1").get(tenantId) || {
            id: null,
            user_name: "Leitor",
            total_points: 0,
            level: 1,
            books_read: 0,
            total_pages_read: 0,
            current_streak: 0,
            longest_streak: 0,
            reviews_count: 0,
            yearly_goal: 12,
        }
    );
}

// ─────────────────────────────────────────────────────────────
// GET /api/statistics
// ─────────────────────────────────────────────────────────────
const getStatistics = (req, res) => {
    const { id: userId, tenantId } = req.user;
    const up = getUserProgress(userId, tenantId);
    const upId = up.id;

    // ── 1. userStats ──────────────────────────────────────────
    const totals = db
        .prepare(
            `SELECT
        COUNT(*) AS total_books,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) AS books_read,
        SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END) AS books_reading,
        SUM(CASE WHEN status = 'want_to_read' THEN 1 ELSE 0 END) AS books_wanted,
        ROUND(AVG(CASE WHEN rating > 0 THEN CAST(rating AS REAL) END), 1) AS avg_rating
      FROM books WHERE tenant_id = ?`,
        )
        .get(tenantId);

    const weeklyPages = upId
        ? db
              .prepare(
                  `SELECT COALESCE(SUM(pages_read),0) AS total FROM reading_activities
         WHERE user_progress_id = ? AND activity_date >= date('now', '-7 days')`,
              )
              .get(upId)?.total || 0
        : 0;

    const favCatRow = db
        .prepare(
            `SELECT c.name FROM reading_progresses rp
       JOIN books b ON b.id = rp.book_id
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL AND c.name IS NOT NULL
       GROUP BY c.name ORDER BY COUNT(*) DESC LIMIT 1`,
        )
        .get(tenantId);

    // Livros lidos no ano corrente (não o total de todos os tempos)
    const yearlyBooksRead =
        db
            .prepare(
                `SELECT COUNT(*) AS c FROM reading_progresses
         WHERE tenant_id = ? AND end_date IS NOT NULL
           AND strftime('%Y', end_date) = strftime('%Y', 'now')`,
            )
            .get(tenantId)?.c || 0;

    const yearlyGoalPercent = (up.yearly_goal || 0) > 0 ? Math.min(100, Math.round((yearlyBooksRead / up.yearly_goal) * 100)) : 0;

    // Streak efetiva: se último dia de leitura foi antes de ontem, sequência está quebrada
    const todayStat = new Date().toISOString().slice(0, 10);
    const ydStatDate = new Date();
    ydStatDate.setDate(ydStatDate.getDate() - 1);
    const ydStatStr = ydStatDate.toISOString().slice(0, 10);
    const effectiveStreak = up.last_reading_date && up.last_reading_date < ydStatStr ? 0 : up.current_streak || 0;

    const userStats = {
        totalBooks: totals.total_books || 0,
        booksRead: totals.books_read || 0,
        booksReading: totals.books_reading || 0,
        booksWantToRead: totals.books_wanted || 0,
        totalPagesRead: up.total_pages_read || 0,
        weeklyPages,
        currentStreak: effectiveStreak,
        longestStreak: up.longest_streak || 0,
        averageRating: totals.avg_rating || 0,
        favoriteCategory: favCatRow?.name || "N/A",
        reviewsCount: up.reviews_count || 0,
        level: Math.floor(up.level || 1),
        totalPoints: up.total_points || 0,
        yearlyGoalPercent,
        yearlyBooksRead,
        userName: up.user_name || "Leitor",
    };

    // ── 2. Leitura Mensal — ano atual (dicionário Jan–Dez) ────
    const monthlyRows = db
        .prepare(
            `SELECT CAST(strftime('%m', end_date) AS INTEGER) AS month, COUNT(*) AS cnt
       FROM reading_progresses rp
       WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL
         AND strftime('%Y', end_date) = strftime('%Y', 'now')
       GROUP BY month ORDER BY month`,
        )
        .all(tenantId);

    const monthlyReadingData = {};
    MONTH_ABBR.forEach((name, i) => {
        const found = monthlyRows.find((r) => r.month === i + 1);
        monthlyReadingData[name] = found ? found.cnt : 0;
    });

    // ── 3. Tendência — últimos 12 meses ───────────────────────
    const trendBookRows = db
        .prepare(
            `SELECT strftime('%Y-%m', end_date) AS ym, COUNT(*) AS cnt
       FROM reading_progresses rp
       WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL
         AND end_date >= date('now', '-11 months', 'start of month')
       GROUP BY ym ORDER BY ym`,
        )
        .all(tenantId);

    const trendPagesRows = upId
        ? db
              .prepare(
                  `SELECT strftime('%Y-%m', activity_date) AS ym, COALESCE(SUM(pages_read),0) AS total
           FROM reading_activities
           WHERE user_progress_id = ?
             AND activity_date >= date('now', '-11 months', 'start of month')
           GROUP BY ym ORDER BY ym`,
              )
              .all(upId)
        : [];

    const readingTrendData = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const monthLabel = `${MONTH_ABBR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
        const bRow = trendBookRows.find((r) => r.ym === ym);
        const pRow = trendPagesRows.find((r) => r.ym === ym);
        readingTrendData.push({
            month: monthLabel,
            booksRead: bRow ? bRow.cnt : 0,
            pagesRead: pRow ? pRow.total : 0,
        });
    }

    // ── 4. Por Categoria — top 10 ──────────────────────────────
    const catRows = db
        .prepare(
            `SELECT COALESCE(c.name,'Sem categoria') AS category, COALESCE(c.color,'#6b7280') AS color, COUNT(rp.id) AS cnt
       FROM reading_progresses rp
       JOIN books b ON b.id = rp.book_id
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL
       GROUP BY b.category_id ORDER BY cnt DESC LIMIT 10`,
        )
        .all(tenantId);

    const readingByCategory = {};
    catRows.forEach((r) => (readingByCategory[r.category] = r.cnt));

    // ── 5. Por Autor — top 10 ─────────────────────────────────
    const authorRows = db
        .prepare(
            `SELECT b.author, COUNT(rp.id) AS cnt
       FROM reading_progresses rp
       JOIN books b ON b.id = rp.book_id
       WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL
       GROUP BY b.author ORDER BY cnt DESC LIMIT 10`,
        )
        .all(tenantId);

    const readingByAuthor = {};
    authorRows.forEach((r) => (readingByAuthor[r.author] = r.cnt));

    // ── 6. Comparativo Anual — 3 anos ────────────────────────
    const currentYear = new Date().getFullYear();
    const yearlyComparison = {};
    for (let yr = currentYear - 2; yr <= currentYear; yr++) {
        const yrBooks = db
            .prepare(
                `SELECT COUNT(*) AS cnt FROM reading_progresses
         WHERE tenant_id = ? AND end_date IS NOT NULL AND CAST(strftime('%Y', end_date) AS INTEGER) = ?`,
            )
            .get(tenantId, yr);
        const yrPages = db
            .prepare(
                `SELECT COALESCE(SUM(
                   CASE
                     WHEN rp.end_date IS NOT NULL THEN COALESCE(b.pages, 0)
                     ELSE COALESCE(rp.current_page, 0)
                   END
                 ), 0) AS total
         FROM reading_progresses rp
         JOIN books b ON b.id = rp.book_id
         WHERE rp.tenant_id = ? AND (
           (rp.end_date IS NOT NULL AND CAST(strftime('%Y', rp.end_date) AS INTEGER) = ?)
           OR
           (rp.end_date IS NULL AND ? = CAST(strftime('%Y', 'now') AS INTEGER))
         )`,
            )
            .get(tenantId, yr, yr);
        const yrRating = db
            .prepare(
                `SELECT ROUND(AVG(CASE WHEN rp.rating > 0 THEN CAST(rp.rating AS REAL) END), 1) AS avg
         FROM reading_progresses rp
         WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL AND CAST(strftime('%Y', rp.end_date) AS INTEGER) = ?`,
            )
            .get(tenantId, yr);
        yearlyComparison[String(yr)] = {
            year: yr,
            booksRead: yrBooks.cnt || 0,
            totalPages: yrPages.total || 0,
            averageRating: yrRating.avg || 0,
        };
    }

    // ── 7. Velocidade de Leitura ──────────────────────────────
    let readingVelocity = { pagesLast30Days: 0, pagesLast90Days: 0, booksLast30Days: 0, activeDaysLast30: 0, averagePagesPerDay: 0 };
    if (upId) {
        const p30 = db
            .prepare(
                `SELECT COALESCE(SUM(pages_read),0) AS total FROM reading_activities WHERE user_progress_id = ? AND activity_date >= date('now','-30 days')`,
            )
            .get(upId);
        const p90 = db
            .prepare(
                `SELECT COALESCE(SUM(pages_read),0) AS total FROM reading_activities WHERE user_progress_id = ? AND activity_date >= date('now','-90 days')`,
            )
            .get(upId);
        const activeDays = db
            .prepare(
                `SELECT COUNT(DISTINCT date(activity_date)) AS cnt FROM reading_activities WHERE user_progress_id = ? AND activity_date >= date('now','-30 days')`,
            )
            .get(upId);
        const b30 = db
            .prepare(
                `SELECT COUNT(*) AS cnt FROM reading_progresses WHERE tenant_id = ? AND end_date IS NOT NULL AND end_date >= date('now','-30 days')`,
            )
            .get(tenantId);
        const pagesLast30Days = p30.total || 0;
        const activeDaysLast30 = activeDays.cnt || 0;
        readingVelocity = {
            pagesLast30Days,
            pagesLast90Days: p90.total || 0,
            booksLast30Days: b30.cnt || 0,
            activeDaysLast30,
            averagePagesPerDay: activeDaysLast30 > 0 ? Math.round((pagesLast30Days / activeDaysLast30) * 10) / 10 : 0,
        };
    }

    // ── 8. Top 10 Livros Melhor Avaliados ─────────────────────
    const topRatedBooks = db
        .prepare(
            `SELECT b.title, b.author, rp.rating, COALESCE(c.name,'Sem categoria') AS categoryName
       FROM reading_progresses rp
       JOIN books b ON b.id = rp.book_id
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL AND rp.rating > 0
       ORDER BY rp.rating DESC, rp.end_date DESC LIMIT 10`,
        )
        .all(tenantId);

    // ── 9. Comparação Social — plataforma global ──────────────
    const allUsers = db
        .prepare(
            `SELECT id, user_id, books_read, total_pages_read, current_streak, last_reading_date, level, total_points
       FROM user_progresses
       WHERE books_read > 0 OR total_pages_read > 0`,
        )
        .all();

    // Streak efetiva por usuário: zera quem não leu ontem ou hoje
    const _ydSoc = new Date();
    _ydSoc.setDate(_ydSoc.getDate() - 1);
    const _ydSocStr = _ydSoc.toISOString().slice(0, 10);
    const effectiveUserStreak = (u) => (u.last_reading_date && u.last_reading_date < _ydSocStr ? 0 : u.current_streak || 0);

    let socialComparison;
    if (allUsers.length === 0) {
        socialComparison = {
            totalActiveUsers: 1,
            userBooksRead: userStats.booksRead,
            avgBooksRead: userStats.booksRead,
            userPagesRead: userStats.totalPagesRead,
            avgPagesRead: userStats.totalPagesRead,
            userStreak: userStats.currentStreak,
            avgStreak: userStats.currentStreak,
            userLevel: userStats.level,
            avgLevel: userStats.level,
            rankByBooks: 1,
            rankByPages: 1,
            rankByStreak: 1,
            rankByPoints: 1,
            topPercentile: 100,
        };
    } else {
        const avg = (arr) => Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;
        const sortDesc = (key) => [...allUsers].sort((a, b) => b[key] - a[key]);
        const byBooks = sortDesc("books_read");
        const byPages = sortDesc("total_pages_read");
        const byStreak = sortDesc("current_streak");
        const byPoints = sortDesc("total_points");
        const idxBooks = byBooks.findIndex((u) => u.user_id === userId);
        const idxPages = byPages.findIndex((u) => u.user_id === userId);
        const idxStreak = byStreak.findIndex((u) => u.user_id === userId);
        const idxPoints = byPoints.findIndex((u) => u.user_id === userId);
        const total = allUsers.length;
        const rankByBooks = idxBooks >= 0 ? idxBooks + 1 : total + 1;
        const rankByPages = idxPages >= 0 ? idxPages + 1 : total + 1;
        const rankByStreak = idxStreak >= 0 ? idxStreak + 1 : total + 1;
        const rankByPoints = idxPoints >= 0 ? idxPoints + 1 : total + 1;
        socialComparison = {
            totalActiveUsers: total,
            userBooksRead: userStats.booksRead,
            avgBooksRead: avg(allUsers.map((u) => u.books_read)),
            userPagesRead: userStats.totalPagesRead,
            avgPagesRead: avg(allUsers.map((u) => u.total_pages_read)),
            userStreak: userStats.currentStreak,
            avgStreak: avg(allUsers.map((u) => effectiveUserStreak(u))),
            userLevel: userStats.level,
            avgLevel: avg(allUsers.map((u) => Math.floor(u.level || 1))),
            rankByBooks,
            rankByPages,
            rankByStreak,
            rankByPoints,
            topPercentile: Math.round(((total - rankByBooks + 1) / total) * 100 * 10) / 10,
        };
    }

    // ── 10. Leaderboard Global (plataforma) ───────────────────
    const globalLeaderboard = db
        .prepare(
            `SELECT up.user_name AS userName, up.level, up.total_points AS totalPoints,
              up.books_read AS booksRead, up.total_pages_read AS totalPages,
              up.current_streak AS currentStreak, up.last_reading_date AS lastReadingDate,
              u.avatar_path AS avatarPath
       FROM user_progresses up
       LEFT JOIN users u ON u.id = up.user_id
       ORDER BY up.total_points DESC, up.books_read DESC LIMIT 10`,
        )
        .all()
        .map((row) => ({
            ...row,
            level: Math.floor(row.level || 1),
            // streak efetiva: zera se não leu ontem nem hoje
            currentStreak: row.lastReadingDate && row.lastReadingDate < _ydSocStr ? 0 : row.currentStreak || 0,
        }));

    // ── 11. Análise de Integridade de Comportamento ───────────────────
    const integrityAnalysis = analyzeReadingIntegrity(userId, tenantId);

    return res.json({
        userStats,
        monthlyReadingData,
        readingTrendData,
        readingByCategory,
        readingByAuthor,
        yearlyComparison,
        readingVelocity,
        topRatedBooks,
        socialComparison,
        globalLeaderboard,
        integrityAnalysis,
    });
};

// ─────────────────────────────────────────────────────────────
// GET /api/statistics/share-card?type=summary|books|streak
// ─────────────────────────────────────────────────────────────
const getShareCard = (req, res) => {
    const { id: userId, tenantId } = req.user;
    const { type = "summary" } = req.query;
    const up = getUserProgress(userId, tenantId);

    const avgRatingRow = db
        .prepare(
            `SELECT ROUND(AVG(CASE WHEN rp.rating > 0 THEN CAST(rp.rating AS REAL) END), 1) AS avg
       FROM reading_progresses rp WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL`,
        )
        .get(tenantId);

    const favCatRow = db
        .prepare(
            `SELECT c.name FROM reading_progresses rp
       JOIN books b ON b.id = rp.book_id
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL AND c.name IS NOT NULL
       GROUP BY c.name ORDER BY COUNT(*) DESC LIMIT 1`,
        )
        .get(tenantId);

    const booksRead =
        db.prepare(`SELECT COUNT(*) AS cnt FROM reading_progresses WHERE tenant_id = ? AND end_date IS NOT NULL`).get(tenantId)?.cnt || 0;

    const totalPages =
        db
            .prepare(
                `SELECT COALESCE(SUM(b.pages),0) AS total FROM reading_progresses rp
       JOIN books b ON b.id = rp.book_id WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL`,
            )
            .get(tenantId)?.total || 0;

    const _ydSC = new Date();
    _ydSC.setDate(_ydSC.getDate() - 1);
    const _ydSCStr = _ydSC.toISOString().slice(0, 10);

    return res.json({
        userName: up.user_name || "Leitor",
        level: Math.floor(up.level || 1),
        totalPoints: up.total_points || 0,
        booksRead,
        totalPages,
        currentStreak: up.last_reading_date && up.last_reading_date < _ydSCStr ? 0 : up.current_streak || 0,
        averageRating: avgRatingRow?.avg || 0,
        favoriteCategory: favCatRow?.name || "N/A",
        type,
    });
};

module.exports = { getStatistics, getShareCard };
