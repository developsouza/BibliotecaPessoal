const db = require("../config/database");

// ─── Cache em memória (5 minutos) ──────────────────────────
const _cache = new Map(); // key = `dash_${tenantId}` → { data, expiresAt }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function getCached(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        _cache.delete(key);
        return null;
    }
    return entry.data;
}
function setCached(key, data) {
    _cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}
function invalidateCache(tenantId) {
    _cache.delete(`dash_${tenantId}`);
}

// GET /api/dashboard
async function getDashboard(req, res) {
    try {
        const tid = req.user.tenantId;
        const uid = req.user.id;
        const cacheKey = `dash_${tid}`;

        // Invalidar cache se ?refresh
        if (req.query.refresh !== undefined) invalidateCache(tid);

        res.setHeader("Cache-Control", "no-store");

        // Carregar dados cacheáveis
        let cached = getCached(cacheKey);
        if (!cached) {
            // ----- Stats gerais -----
            const totalBooks = db.prepare("SELECT COUNT(*) as c FROM books WHERE tenant_id = ?").get(tid).c;
            const booksRead = db.prepare("SELECT COUNT(*) as c FROM books WHERE tenant_id = ? AND status = 'read'").get(tid).c;
            const booksReading = db.prepare("SELECT COUNT(*) as c FROM books WHERE tenant_id = ? AND status = 'reading'").get(tid).c;
            const booksWantToRead = db.prepare("SELECT COUNT(*) as c FROM books WHERE tenant_id = ? AND status = 'want_to_read'").get(tid).c;
            const booksPaused = db.prepare("SELECT COUNT(*) as c FROM books WHERE tenant_id = ? AND status = 'paused'").get(tid).c;
            const totalLoans = db.prepare("SELECT COUNT(*) as c FROM loans WHERE tenant_id = ?").get(tid).c;
            const activeLoans = db.prepare("SELECT COUNT(*) as c FROM loans WHERE tenant_id = ? AND is_returned = 0").get(tid).c;

            // ----- Lendo agora (com progresso) -----
            const currentlyReading = db
                .prepare(
                    `
                SELECT b.id, b.title, b.author,
                       b.cover_image_path AS coverImagePath,
                       b.pages,
                       rp.current_page AS currentPage,
                       rp.start_date AS startDate
                FROM books b
                LEFT JOIN reading_progresses rp ON rp.book_id = b.id AND rp.tenant_id = b.tenant_id AND rp.end_date IS NULL
                WHERE b.tenant_id = ? AND b.status = 'reading'
                ORDER BY rp.created_at DESC
                LIMIT 6
            `,
                )
                .all(tid);

            // ----- Livros recentes -----
            const recentBooks = db
                .prepare(
                    `
                SELECT id, title, author, cover_image_path AS coverImagePath, status, rating, created_at AS createdAt
                FROM books WHERE tenant_id = ?
                ORDER BY created_at DESC LIMIT 8
            `,
                )
                .all(tid);

            // ----- Livros em destaque -----
            const featuredBooks = db
                .prepare(
                    `
                SELECT id, title, author, cover_image_path AS coverImagePath, status, rating
                FROM books WHERE tenant_id = ? AND is_featured = 1
                ORDER BY created_at DESC LIMIT 6
            `,
                )
                .all(tid);

            // ----- Top 5 mais bem avaliados -----
            const topRated = db
                .prepare(
                    `
                SELECT id, title, author, cover_image_path AS coverImagePath, status, rating
                FROM books WHERE tenant_id = ? AND rating > 0
                ORDER BY rating DESC, created_at DESC LIMIT 5
            `,
                )
                .all(tid);

            // ----- Estatísticas por categoria -----
            const categoryStats = db
                .prepare(
                    `
                SELECT c.name, c.color, c.icon, COUNT(b.id) AS bookCount
                FROM categories c
                LEFT JOIN books b ON b.category_id = c.id AND b.tenant_id = c.tenant_id
                WHERE c.tenant_id = ?
                GROUP BY c.id
                ORDER BY bookCount DESC
                LIMIT 10
            `,
                )
                .all(tid);

            cached = {
                stats: { totalBooks, booksRead, booksReading, booksWantToRead, booksPaused, totalLoans, activeLoans },
                currentlyReading,
                recentBooks,
                featuredBooks,
                topRated,
                categoryStats,
            };
            setCached(cacheKey, cached);
        }

        // Dados de gamificação SEMPRE frescos (nunca cacheados)
        const userProgress = db.prepare("SELECT * FROM user_progresses WHERE tenant_id = ? AND user_id = ?").get(tid, uid);

        // Corrige streak exibida: se o último dia de leitura foi antes de ontem,
        // a sequência está quebrada — exibe 0 sem precisar gravar no banco agora.
        if (userProgress) {
            const todayStr = new Date().toISOString().slice(0, 10);
            const ydDate = new Date();
            ydDate.setDate(ydDate.getDate() - 1);
            const ydStr = ydDate.toISOString().slice(0, 10);
            if (userProgress.last_reading_date && userProgress.last_reading_date < ydStr) {
                userProgress.current_streak = 0;
            }
        }
        const recentAchievements = db
            .prepare(
                `
            SELECT a.name, a.icon, a.points, a.rarity, ua.unlocked_at AS unlockedAt
            FROM user_achievements ua
            JOIN achievements a ON a.id = ua.achievement_id
            WHERE ua.tenant_id = ? AND ua.user_id = ?
            ORDER BY ua.unlocked_at DESC LIMIT 3
        `,
            )
            .all(tid, uid);

        return res.json({ ...cached, userProgress, recentAchievements });
    } catch (err) {
        console.error("getDashboard:", err);
        return res.status(500).json({ error: "Erro ao carregar dashboard" });
    }
}

// POST /api/dashboard/clear-cache
function clearDashboardCache(req, res) {
    invalidateCache(req.user.tenantId);
    return res.json({ success: true, message: "Cache do dashboard limpo." });
}

module.exports = { getDashboard, clearDashboardCache, invalidateCache };
