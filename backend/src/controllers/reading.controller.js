const db = require("../config/database");
const { invalidateCache: invalidateDashCache } = require("./dashboard.controller");
const { updateUserProgress } = require("../services/gamification.service");
const { checkAndUnlockAchievements } = require("../services/achievement.service");
const planFeature = require("../services/planFeature.service");

// Campos de retorno dos livros
const BOOK_FIELDS = `
    b.id, b.title, b.author, b.cover_image_path AS coverImagePath,
    b.pages, b.status, b.rating
`;

function camelizeProgress(p) {
    if (!p) return null;
    return {
        id: p.id,
        bookId: p.book_id,
        startDate: p.start_date,
        endDate: p.end_date,
        currentPage: p.current_page,
        notes: p.notes,
        rating: p.rating,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        // joined
        title: p.title,
        author: p.author,
        coverImagePath: p.coverImagePath,
        pages: p.pages,
        bookStatus: p.status,
    };
}

// GET /api/reading — leituras em andamento (sem end_date)
async function listReading(req, res) {
    try {
        const rows = db
            .prepare(
                `
            SELECT rp.*,
                   b.title, b.author,
                   b.cover_image_path AS coverImagePath,
                   b.pages, b.status
            FROM reading_progresses rp
            JOIN books b ON b.id = rp.book_id
            WHERE rp.tenant_id = ? AND rp.end_date IS NULL
            ORDER BY rp.created_at DESC
        `,
            )
            .all(req.user.tenantId);

        return res.json(rows.map(camelizeProgress));
    } catch (err) {
        console.error("listReading:", err);
        return res.status(500).json({ error: "Erro ao listar leituras" });
    }
}

// GET /api/reading/history
async function getHistory(req, res) {
    try {
        const plan = req.user?.plan || "free";
        const planLimit = planFeature.getMaxReadingHistoryVisible(plan); // Free=10, resto=Infinity

        const { page = 1, pageSize = 20 } = req.query;
        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;

        const totalUnlimited = db
            .prepare("SELECT COUNT(*) as cnt FROM reading_progresses WHERE tenant_id = ? AND end_date IS NOT NULL")
            .get(req.user.tenantId).cnt;

        // Para planos limitados, calcular o total visível
        const totalVisible = planLimit === Infinity ? totalUnlimited : Math.min(totalUnlimited, planLimit);

        // Restringir offset ao máximo visível
        const effectiveOffset = planLimit === Infinity ? offset : Math.min(offset, Math.max(0, totalVisible - limit));
        const effectiveLimit = planLimit === Infinity ? limit : Math.min(limit, Math.max(0, totalVisible - effectiveOffset));

        const rows = db
            .prepare(
                `
            SELECT rp.*,
                   b.title, b.author,
                   b.cover_image_path AS coverImagePath,
                   b.pages, b.status
            FROM reading_progresses rp
            JOIN books b ON b.id = rp.book_id
            WHERE rp.tenant_id = ? AND rp.end_date IS NOT NULL
            ORDER BY rp.end_date DESC
            LIMIT ? OFFSET ?
        `,
            )
            .all(req.user.tenantId, effectiveLimit, effectiveOffset);

        return res.json({
            total: totalVisible,
            totalUnlimited,
            page: parseInt(page),
            pageSize: limit,
            isLimited: planLimit !== Infinity && totalUnlimited > planLimit,
            planLimit: planLimit === Infinity ? null : planLimit,
            data: rows.map(camelizeProgress),
        });
    } catch (err) {
        console.error("getHistory:", err);
        return res.status(500).json({ error: "Erro ao buscar histórico" });
    }
}

// GET /api/reading/book/:bookId
async function getBookProgress(req, res) {
    try {
        const rows = db
            .prepare(
                `
            SELECT rp.*,
                   b.title, b.author,
                   b.cover_image_path AS coverImagePath,
                   b.pages, b.status
            FROM reading_progresses rp
            JOIN books b ON b.id = rp.book_id
            WHERE rp.tenant_id = ? AND rp.book_id = ?
            ORDER BY rp.created_at DESC
        `,
            )
            .all(req.user.tenantId, req.params.bookId);

        return res.json(rows.map(camelizeProgress));
    } catch (err) {
        console.error("getBookProgress:", err);
        return res.status(500).json({ error: "Erro ao buscar progresso" });
    }
}

// POST /api/reading — criar ou atualizar progresso
async function upsertProgress(req, res) {
    try {
        const { bookId, currentPage, notes, rating, startDate, endDate } = req.body;

        if (!bookId) return res.status(400).json({ error: "bookId é obrigatório" });

        // Validação do tamanho das notas por plano
        if (notes) {
            const plan = req.user.plan || "free";
            const maxNotes = planFeature.getMaxNotesLength(plan);
            if (notes.length > maxNotes) {
                return res.status(400).json({
                    error: `Notas ultrapassam o limite de ${maxNotes} caracteres do plano ${plan}. Faça upgrade para escrever notas maiores.`,
                    limit: maxNotes,
                    current: notes.length,
                });
            }
        }

        const book = db.prepare("SELECT * FROM books WHERE id = ? AND tenant_id = ?").get(bookId, req.user.tenantId);

        if (!book) return res.status(404).json({ error: "Livro não encontrado" });

        // Verifica se já existe registro em andamento para este livro
        const existing = db
            .prepare("SELECT * FROM reading_progresses WHERE tenant_id = ? AND book_id = ? AND end_date IS NULL")
            .get(req.user.tenantId, bookId);

        const today = new Date().toISOString().slice(0, 10);
        let progressId;

        if (existing) {
            db.prepare(
                `
                UPDATE reading_progresses
                SET current_page = COALESCE(?, current_page),
                    notes        = COALESCE(?, notes),
                    rating       = COALESCE(?, rating),
                    end_date     = ?,
                    updated_at   = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            ).run(currentPage || null, notes || null, rating || null, endDate || null, existing.id);
            progressId = existing.id;
        } else {
            const result = db
                .prepare(
                    `
                INSERT INTO reading_progresses
                    (tenant_id, user_id, book_id, current_page, notes, rating, start_date, end_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
                )
                .run(req.user.tenantId, req.user.id, bookId, currentPage || 0, notes || null, rating || null, startDate || today, endDate || null);
            progressId = result.lastInsertRowid;
        }

        // Se finalizou (endDate preenchido):
        if (endDate) {
            // Muda status do livro para 'read'
            db.prepare("UPDATE books SET status = 'read', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(bookId);

            // Registra rating no livro se fornecido
            if (rating) {
                db.prepare("UPDATE books SET rating = ? WHERE id = ?").run(rating, bookId);
            }

            // Gamificação
            const userProgress = updateUserProgress(req.user.tenantId, req.user.id, {
                pagesRead: book.pages || 0,
                bookId,
                date: endDate,
            });

            const newAchievements = checkAndUnlockAchievements(req.user.tenantId, req.user.id, userProgress);

            const progress = db.prepare("SELECT * FROM reading_progresses WHERE id = ?").get(progressId);
            invalidateDashCache(req.user.tenantId);
            return res.json({ progress: camelizeProgress(progress), newAchievements });
        }

        // Se ainda em andamento, muda status para 'reading'
        if (book.status === "want_to_read" || book.status === "paused") {
            db.prepare("UPDATE books SET status = 'reading', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(bookId);
        }

        // Atualiza gamificação com páginas lidas em andamento
        if (currentPage) {
            const oldPage = existing?.current_page || 0;
            const pagesAdded = Math.max(0, Number(currentPage) - oldPage);
            if (pagesAdded > 0) {
                updateUserProgress(req.user.tenantId, req.user.id, {
                    pagesRead: pagesAdded,
                    bookId: Number(bookId),
                    date: today,
                });
            } else {
                // Mesmo sem páginas adicionadas, recalcula o total (cobre reduções)
                updateUserProgress(req.user.tenantId, req.user.id, { date: today });
            }
        }

        invalidateDashCache(req.user.tenantId);
        const progress = db.prepare("SELECT * FROM reading_progresses WHERE id = ?").get(progressId);
        return res.json({ progress: camelizeProgress(progress), newAchievements: [] });
    } catch (err) {
        console.error("upsertProgress:", err);
        return res.status(500).json({ error: "Erro ao salvar progresso" });
    }
}

// DELETE /api/reading/:id
async function deleteProgress(req, res) {
    try {
        const progress = db.prepare("SELECT * FROM reading_progresses WHERE id = ? AND tenant_id = ?").get(req.params.id, req.user.tenantId);

        if (!progress) return res.status(404).json({ error: "Registro não encontrado" });

        db.prepare("DELETE FROM reading_progresses WHERE id = ?").run(req.params.id);
        invalidateDashCache(req.user.tenantId);
        return res.json({ message: "Registro de leitura removido" });
    } catch (err) {
        console.error("deleteProgress:", err);
        return res.status(500).json({ error: "Erro ao excluir progresso" });
    }
}

// GET /api/reading/latest?bookId=X
// Retorna o último ReadingProgress de um livro específico
async function getLatestReading(req, res) {
    try {
        const { bookId } = req.query;
        if (!bookId) return res.status(400).json({ success: false, error: "bookId é obrigatório" });

        const progress = db
            .prepare(
                `
            SELECT rp.*,
                   b.title, b.author,
                   b.cover_image_path AS coverImagePath,
                   b.pages, b.status
            FROM reading_progresses rp
            JOIN books b ON b.id = rp.book_id
            WHERE rp.tenant_id = ? AND rp.book_id = ?
            ORDER BY rp.created_at DESC
            LIMIT 1
        `,
            )
            .get(req.user.tenantId, +bookId);

        if (!progress) return res.json({ success: true, data: null });

        return res.json({
            success: true,
            data: {
                id: progress.id,
                startDate: progress.start_date,
                endDate: progress.end_date,
                currentPage: progress.current_page,
                rating: progress.rating,
                isReread: progress.is_reread || false,
                notes: progress.notes,
                bookPages: progress.pages,
                bookStatus: progress.status,
            },
        });
    } catch (err) {
        console.error("getLatestReading:", err);
        return res.status(500).json({ success: false, error: "Erro ao buscar progresso" });
    }
}

// PATCH /api/reading/:id/page
// Atualização rápida da página atual com auto-conclusão
async function updatePage(req, res) {
    try {
        const { currentPage } = req.body;
        if (currentPage === undefined || currentPage < 0) {
            return res.status(400).json({ success: false, error: "currentPage inválido" });
        }

        const progress = db
            .prepare(
                `SELECT rp.*, b.pages, b.status AS bookStatus
             FROM reading_progresses rp
             JOIN books b ON b.id = rp.book_id
             WHERE rp.id = ? AND rp.tenant_id = ?`,
            )
            .get(+req.params.id, req.user.tenantId);

        if (!progress) return res.status(404).json({ success: false, error: "Progresso não encontrado" });

        const oldPage = progress.current_page || 0;
        const bookPages = progress.pages || 0;
        const newPage = Math.min(+currentPage, bookPages || +currentPage);
        const today = new Date().toISOString().slice(0, 10);

        // Auto-conclusão quando página >= total de páginas
        const autoComplete = bookPages > 0 && newPage >= bookPages;
        const endDate = autoComplete ? today : null;

        db.prepare(
            `UPDATE reading_progresses
             SET current_page = ?, end_date = COALESCE(end_date, ?), updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
        ).run(newPage, endDate, +req.params.id);

        let newAchievements = [];
        let userProgress = null;

        if (autoComplete && progress.bookStatus !== "read") {
            // Finaliza a leitura
            db.prepare("UPDATE books SET status = 'read', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(progress.book_id);
            userProgress = updateUserProgress(req.user.tenantId, req.user.id, {
                pagesRead: bookPages,
                bookId: progress.book_id,
                date: today,
            });
            newAchievements = checkAndUnlockAchievements(req.user.tenantId, req.user.id, userProgress);
            invalidateDashCache(req.user.tenantId);
        } else if (newPage > oldPage) {
            // Registra apenas as páginas adicionais
            const pagesAdded = newPage - oldPage;
            userProgress = updateUserProgress(req.user.tenantId, req.user.id, {
                pagesRead: pagesAdded,
                date: today,
            });
            newAchievements = checkAndUnlockAchievements(req.user.tenantId, req.user.id, userProgress);
        }

        const percent = bookPages > 0 ? Math.round((newPage / bookPages) * 100) : 0;

        return res.json({
            success: true,
            currentPage: newPage,
            percent,
            completed: autoComplete,
            newAchievements: newAchievements || [],
        });
    } catch (err) {
        console.error("updatePage:", err);
        return res.status(500).json({ success: false, error: "Erro ao atualizar página" });
    }
}

module.exports = { listReading, getHistory, getBookProgress, upsertProgress, deleteProgress, getLatestReading, updatePage };
