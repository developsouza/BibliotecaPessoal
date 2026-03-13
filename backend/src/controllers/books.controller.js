const db = require("../config/database");
const path = require("path");
const fs = require("fs");
const { updateUserProgress } = require("../services/gamification.service");
const { checkAndUnlockAchievements } = require("../services/achievement.service");
const planFeature = require("../services/planFeature.service");
const { invalidateCache: invalidateDashCache } = require("./dashboard.controller");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");

// ─── Helpers ────────────────────────────────────────────────
function camelizeBook(row) {
    if (!row) return null;
    return {
        id: row.id,
        title: row.title,
        author: row.author,
        publisher: row.publisher,
        publishYear: row.publish_year,
        pages: row.pages,
        isbn: row.isbn,
        cdd: row.cdd,
        cdu: row.cdu,
        language: row.language,
        edition: row.edition,
        volumes: row.volumes,
        synopsis: row.synopsis,
        coverImagePath: row.cover_image_path,
        shelfLocation: row.shelf_location,
        categoryId: row.category_id,
        copies: row.copies,
        availableCopies: row.available_copies,
        status: row.status,
        rating: row.rating,
        isFeatured: !!row.is_featured,
        createdAt: row.created_at,
        category: row.category_id
            ? {
                  id: row.cat_id,
                  name: row.cat_name,
                  color: row.cat_color,
                  icon: row.cat_icon,
              }
            : null,
    };
}

async function validateBookLimit(tenantId) {
    const tenant = db.prepare("SELECT plan, max_books FROM tenants WHERE id = ?").get(tenantId);
    if (!tenant) return { ok: false, message: "Tenant não encontrado" };
    if (tenant.plan === "pro" || tenant.plan === "master") return { ok: true };
    const { c } = db.prepare("SELECT COUNT(*) as c FROM books WHERE tenant_id = ?").get(tenantId);
    if (c >= tenant.max_books) {
        return { ok: false, message: `Limite de ${tenant.max_books} livros atingido. Faça upgrade para adicionar mais.` };
    }
    return { ok: true };
}

/**
 * Valida o limite de armazenamento antes de aceitar um upload.
 * Retorna { ok: true } se dentro do limite, ou { ok: false, message } se excedido.
 */
function validateStorageLimit(tenantId, plan, newFileSizeBytes) {
    const limits = planFeature.getLimits(plan);
    if (limits.maxStorageMB === Infinity) return { ok: true };
    const maxBytes = limits.maxStorageMB * 1024 * 1024;

    // Somar capas existentes do tenant
    const rows = db.prepare("SELECT cover_image_path FROM books WHERE tenant_id = ? AND cover_image_path IS NOT NULL").all(tenantId);
    let usedBytes = 0;
    for (const row of rows) {
        try {
            const fp = path.join(__dirname, "../../", row.cover_image_path);
            const stat = fs.statSync(fp);
            usedBytes += stat.size;
        } catch {
            /* arquivo ausente */
        }
    }
    if (usedBytes + newFileSizeBytes > maxBytes) {
        const usedMB = Math.round((usedBytes / (1024 * 1024)) * 10) / 10;
        return {
            ok: false,
            message: `Limite de armazenamento atingido (${usedMB} MB / ${limits.maxStorageMB} MB). Faça upgrade para adicionar mais.`,
        };
    }
    return { ok: true };
}

const BOOKS_SELECT = `
  SELECT b.*,
         c.id AS cat_id, c.name AS cat_name, c.color AS cat_color, c.icon AS cat_icon
  FROM books b
  LEFT JOIN categories c ON c.id = b.category_id
`;

// ─── GET /api/books ─────────────────────────────────────────
function listBooks(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const { search = "", categoryId, status, sort = "recent", isLoaned, page = 1, pageSize = 12 } = req.query;

        const conditions = ["b.tenant_id = ?"];
        const params = [tenantId];

        if (search) {
            conditions.push("(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)");
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (categoryId) {
            conditions.push("b.category_id = ?");
            params.push(+categoryId);
        }
        if (status) {
            conditions.push("b.status = ?");
            params.push(status);
        }
        if (isLoaned === "true") {
            conditions.push("b.available_copies < b.copies");
        }

        const where = `WHERE ${conditions.join(" AND ")}`;

        const sortMap = { recent: "b.created_at DESC", title: "b.title ASC", author: "b.author ASC", rating: "b.rating DESC" };
        const orderBy = sortMap[sort] || "b.created_at DESC";

        const { totalCount } = db.prepare(`SELECT COUNT(*) as totalCount FROM books b ${where}`).get(...params);
        const lmt = Math.min(+pageSize, 500);
        const offset = (+page - 1) * lmt;
        const rows = db.prepare(`${BOOKS_SELECT} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, lmt, offset);

        return res.json({
            items: rows.map(camelizeBook),
            totalCount,
            page: +page,
            pageSize: lmt,
            totalPages: Math.ceil(totalCount / lmt),
        });
    } catch (err) {
        console.error("listBooks:", err);
        return res.status(500).json({ error: "Erro ao listar livros" });
    }
}

// ─── GET /api/books/autocomplete ────────────────────────────
function autocomplete(req, res) {
    try {
        const { q = "" } = req.query;
        if (q.length < 2) return res.json([]);
        const rows = db
            .prepare(
                `SELECT id, title, author, cover_image_path FROM books
       WHERE tenant_id = ? AND (title LIKE ? OR author LIKE ?)
       LIMIT 8`,
            )
            .all(req.user.tenantId, `%${q}%`, `%${q}%`);
        return res.json(rows.map((r) => ({ id: r.id, title: r.title, author: r.author, coverImagePath: r.cover_image_path })));
    } catch (err) {
        return res.status(500).json({ error: "Erro no autocomplete" });
    }
}

// ─── GET /api/books/export ──────────────────────────────────
function exportBooks(req, res) {
    try {
        const { format = "json" } = req.query;

        // Guard de plano para xlsx e pdf
        if (format === "xlsx" || format === "pdf") {
            const plan = req.user?.plan || "free";
            if (!planFeature.canExportData(plan)) {
                return res.status(403).json({
                    error: "Exportação em Excel/PDF requer plano Premium ou superior.",
                    requiresUpgrade: true,
                });
            }
        }

        const rows = db.prepare(`${BOOKS_SELECT} WHERE b.tenant_id = ? ORDER BY b.title ASC`).all(req.user.tenantId);
        const books = rows.map(camelizeBook);

        // ── CSV ──────────────────────────────────────────────
        if (format === "csv") {
            const keys = ["id", "title", "author", "publisher", "publishYear", "pages", "isbn", "language", "status", "rating"];
            const header = keys.join(",");
            const lines = books.map((b) => keys.map((k) => `"${String(b[k] ?? "").replace(/"/g, '""')}"`).join(","));
            res.setHeader("Content-Disposition", 'attachment; filename="biblioteca.csv"');
            res.setHeader("Content-Type", "text/csv");
            return res.send([header, ...lines].join("\n"));
        }

        // ── XLSX (SheetJS) ───────────────────────────────────
        if (format === "xlsx") {
            const STATUS_LABEL = { want_to_read: "Quero Ler", reading: "Lendo", read: "Lido", paused: "Pausado" };
            const wsData = [
                ["ID", "Título", "Autor", "ISBN", "Editora", "Ano", "Páginas", "Categoria", "Status", "Avaliação", "CDD"],
                ...books.map((b) => [
                    b.id,
                    b.title,
                    b.author,
                    b.isbn || "",
                    b.publisher || "",
                    b.publishYear || "",
                    b.pages || "",
                    b.category?.name || "Sem categoria",
                    STATUS_LABEL[b.status] || b.status,
                    b.rating || 0,
                    b.cdd || "",
                ]),
            ];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            // Larguras de coluna
            ws["!cols"] = [4, 30, 20, 14, 18, 6, 8, 16, 12, 8, 10].map((w) => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws, "Biblioteca");
            const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
            res.setHeader("Content-Disposition", 'attachment; filename="biblioteca.xlsx"');
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            return res.end(buf);
        }

        // ── PDF (PDFKit) ─────────────────────────────────────
        if (format === "pdf") {
            const STATUS_LABEL = { want_to_read: "Quero Ler", reading: "Lendo", read: "Lido", paused: "Pausado" };
            const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
            res.setHeader("Content-Disposition", 'attachment; filename="biblioteca.pdf"');
            res.setHeader("Content-Type", "application/pdf");
            doc.pipe(res);

            // Cabeçalho
            doc.fontSize(16).font("Helvetica-Bold").text("Minha Biblioteca", { align: "center" });
            doc.fontSize(9)
                .font("Helvetica")
                .fillColor("#6b7280")
                .text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} — ${books.length} livros`, { align: "center" });
            doc.moveDown(0.6);

            // Linha separadora
            doc.moveTo(40, doc.y).lineTo(802, doc.y).strokeColor("#e5e7eb").stroke();
            doc.moveDown(0.4);

            // Cabeçalhos da tabela
            const cols = [
                { label: "Título", x: 40, w: 200 },
                { label: "Autor", x: 245, w: 150 },
                { label: "Editora", x: 400, w: 120 },
                { label: "Status", x: 525, w: 80 },
                { label: "Avaliação", x: 610, w: 60 },
                { label: "CDD", x: 675, w: 60 },
            ];
            const headerY = doc.y;
            doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827");
            cols.forEach(({ label, x }) => doc.text(label, x, headerY, { lineBreak: false }));
            doc.moveDown(0.5);

            // Linhas dos livros
            doc.font("Helvetica").fontSize(7.5).fillColor("#374151");
            let rowNum = 0;
            for (const b of books) {
                const y = doc.y;
                if (y > 540) {
                    doc.addPage({ margin: 40, size: "A4", layout: "landscape" });
                    doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827");
                    cols.forEach(({ label, x }) => doc.text(label, x, doc.y, { lineBreak: false }));
                    doc.moveDown(0.5);
                    doc.font("Helvetica").fontSize(7.5).fillColor("#374151");
                    rowNum = 0;
                }
                // Fundo zebra
                if (rowNum % 2 === 0) {
                    doc.rect(40, doc.y - 1, 762, 13)
                        .fill("#f9fafb")
                        .fillColor("#374151");
                }
                const ry = doc.y;
                doc.text((b.title || "").substring(0, 40), cols[0].x, ry, { lineBreak: false, width: cols[0].w });
                doc.text((b.author || "").substring(0, 28), cols[1].x, ry, { lineBreak: false, width: cols[1].w });
                doc.text((b.publisher || "").substring(0, 22), cols[2].x, ry, { lineBreak: false, width: cols[2].w });
                doc.text(STATUS_LABEL[b.status] || "", cols[3].x, ry, { lineBreak: false, width: cols[3].w });
                doc.text(b.rating ? `${b.rating}/5` : "-", cols[4].x, ry, { lineBreak: false, width: cols[4].w });
                doc.text(b.cdd || "", cols[5].x, ry, { lineBreak: false, width: cols[5].w });
                doc.moveDown(0.55);
                rowNum++;
            }

            // Rodapé com total
            doc.moveDown(0.5);
            doc.moveTo(40, doc.y).lineTo(802, doc.y).strokeColor("#e5e7eb").stroke();
            doc.moveDown(0.3);
            doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text(`Total: ${books.length} livro(s)`, 40, doc.y, { lineBreak: false });

            doc.end();
            return;
        }

        // ── JSON padrão ──────────────────────────────────────
        res.setHeader("Content-Disposition", 'attachment; filename="biblioteca.json"');
        res.setHeader("Content-Type", "application/json");
        return res.json(books);
    } catch (err) {
        console.error("exportBooks:", err);
        return res.status(500).json({ error: "Erro ao exportar" });
    }
}

// ─── GET /api/books/:id ─────────────────────────────────────
function getBook(req, res) {
    try {
        const row = db.prepare(`${BOOKS_SELECT} WHERE b.id = ? AND b.tenant_id = ?`).get(+req.params.id, req.user.tenantId);
        if (!row) return res.status(404).json({ error: "Livro não encontrado" });
        return res.json(camelizeBook(row));
    } catch (err) {
        return res.status(500).json({ error: "Erro ao buscar livro" });
    }
}

// ─── POST /api/books ────────────────────────────────────────
async function createBook(req, res) {
    try {
        const limit = await validateBookLimit(req.user.tenantId);
        if (!limit.ok) return res.status(403).json({ error: limit.message });

        const {
            title,
            author,
            publisher,
            publishYear,
            pages,
            isbn,
            cdd,
            cdu,
            language = "Português",
            edition,
            volumes = 1,
            synopsis,
            shelfLocation,
            categoryId,
            copies = 1,
            status = "want_to_read",
            rating = 0,
            isFeatured = 0,
        } = req.body;

        if (!title || !author) return res.status(400).json({ error: "Título e autor são obrigatórios" });

        // Validar limite de armazenamento se houver upload
        if (req.file) {
            const storageCheck = validateStorageLimit(req.user.tenantId, req.user.plan, req.file.size);
            if (!storageCheck.ok) {
                fs.unlinkSync(req.file.path); // remover arquivo recém-enviado
                return res.status(403).json({ error: storageCheck.message, requiresUpgrade: true });
            }
        }

        const coverPath = req.file ? `/uploads/covers/${req.file.filename}` : null;

        const { lastInsertRowid } = db
            .prepare(
                `
      INSERT INTO books
        (tenant_id, title, author, publisher, publish_year, pages, isbn, cdd, cdu,
         language, edition, volumes, synopsis, cover_image_path, shelf_location,
         category_id, copies, available_copies, status, rating, is_featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
            )
            .run(
                req.user.tenantId,
                title,
                author,
                publisher || null,
                +publishYear || null,
                +pages || null,
                isbn || null,
                cdd || null,
                cdu || null,
                language,
                edition || null,
                +volumes,
                synopsis || null,
                coverPath,
                shelfLocation || null,
                +categoryId || null,
                +copies,
                +copies,
                status,
                +rating,
                +isFeatured ? 1 : 0,
            );

        const row = db.prepare(`${BOOKS_SELECT} WHERE b.id = ?`).get(lastInsertRowid);
        invalidateDashCache(req.user.tenantId);
        return res.status(201).json(camelizeBook(row));
    } catch (err) {
        console.error("createBook:", err);
        return res.status(500).json({ error: "Erro ao criar livro" });
    }
}

// ─── PUT /api/books/:id ─────────────────────────────────────
async function updateBook(req, res) {
    try {
        const book = db.prepare("SELECT * FROM books WHERE id = ? AND tenant_id = ?").get(+req.params.id, req.user.tenantId);
        if (!book) return res.status(404).json({ error: "Livro não encontrado" });

        const {
            title,
            author,
            publisher,
            publishYear,
            pages,
            isbn,
            cdd,
            cdu,
            language,
            edition,
            volumes,
            synopsis,
            shelfLocation,
            categoryId,
            copies,
            status,
            rating,
            isFeatured,
        } = req.body;

        let coverPath = book.cover_image_path;
        if (req.file) {
            // Validar limite de armazenamento
            const storageCheck = validateStorageLimit(req.user.tenantId, req.user.plan, req.file.size);
            if (!storageCheck.ok) {
                fs.unlinkSync(req.file.path);
                return res.status(403).json({ error: storageCheck.message, requiresUpgrade: true });
            }
            // Remover capa antiga se existir
            if (coverPath) {
                const oldFile = path.join(__dirname, "../../", coverPath);
                if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
            }
            coverPath = `/uploads/covers/${req.file.filename}`;
        }

        const newCopies = copies !== undefined ? +copies : book.copies;
        const oldCopies = book.copies;
        const diff = newCopies - oldCopies;
        const newAvailable = Math.max(0, book.available_copies + diff);

        db.prepare(
            `
      UPDATE books SET
        title = ?, author = ?, publisher = ?, publish_year = ?, pages = ?, isbn = ?,
        cdd = ?, cdu = ?, language = ?, edition = ?, volumes = ?, synopsis = ?,
        cover_image_path = ?, shelf_location = ?, category_id = ?,
        copies = ?, available_copies = ?, status = ?, rating = ?, is_featured = ?
      WHERE id = ? AND tenant_id = ?
    `,
        ).run(
            title ?? book.title,
            author ?? book.author,
            publisher !== undefined ? publisher || null : book.publisher,
            publishYear !== undefined ? +publishYear || null : book.publish_year,
            pages !== undefined ? +pages || null : book.pages,
            isbn !== undefined ? isbn || null : book.isbn,
            cdd !== undefined ? cdd || null : book.cdd,
            cdu !== undefined ? cdu || null : book.cdu,
            language ?? book.language,
            edition !== undefined ? edition || null : book.edition,
            volumes !== undefined ? +volumes : book.volumes,
            synopsis !== undefined ? synopsis || null : book.synopsis,
            coverPath,
            shelfLocation !== undefined ? shelfLocation || null : book.shelf_location,
            categoryId !== undefined ? +categoryId || null : book.category_id,
            newCopies,
            newAvailable,
            status ?? book.status,
            rating !== undefined ? +rating : book.rating,
            isFeatured !== undefined ? (+isFeatured ? 1 : 0) : book.is_featured,
            +req.params.id,
            req.user.tenantId,
        );

        const row = db.prepare(`${BOOKS_SELECT} WHERE b.id = ?`).get(+req.params.id);
        invalidateDashCache(req.user.tenantId);
        return res.json(camelizeBook(row));
    } catch (err) {
        console.error("updateBook:", err);
        return res.status(500).json({ error: "Erro ao editar livro" });
    }
}

// ─── DELETE /api/books/:id ───────────────────────────────────
function deleteBook(req, res) {
    try {
        const book = db.prepare("SELECT * FROM books WHERE id = ? AND tenant_id = ?").get(+req.params.id, req.user.tenantId);
        if (!book) return res.status(404).json({ error: "Livro não encontrado" });

        // Remover capa do disco
        if (book.cover_image_path) {
            const file = path.join(__dirname, "../../", book.cover_image_path);
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }

        db.prepare("DELETE FROM books WHERE id = ? AND tenant_id = ?").run(+req.params.id, req.user.tenantId);
        invalidateDashCache(req.user.tenantId);
        return res.json({ message: "Livro excluído com sucesso" });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao excluir livro" });
    }
}

// ─── PATCH /api/books/:id/status ────────────────────────────
// Atualização rápida de status via AJAX (sem recarregar a página)
function updateStatus(req, res) {
    try {
        const { status } = req.body;
        const validStatuses = ["want_to_read", "reading", "read", "paused"];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: "Status inválido" });
        }

        const book = db.prepare("SELECT * FROM books WHERE id = ? AND tenant_id = ?").get(+req.params.id, req.user.tenantId);
        if (!book) return res.status(404).json({ success: false, error: "Livro não encontrado" });

        const previousStatus = book.status;
        db.prepare("UPDATE books SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(
            status,
            +req.params.id,
            req.user.tenantId,
        );

        // Gamificação: se mudou para 'read' e tinha páginas → registra atividade
        if (status === "read" && previousStatus !== "read" && book.pages) {
            const userProgress = updateUserProgress(req.user.tenantId, req.user.id, {
                pagesRead: book.pages,
                bookId: book.id,
                date: new Date().toISOString().slice(0, 10),
            });
            checkAndUnlockAchievements(req.user.tenantId, req.user.id, userProgress);
        } else {
            updateUserProgress(req.user.tenantId, req.user.id);
        }

        invalidateDashCache(req.user.tenantId);
        return res.json({ success: true, status });
    } catch (err) {
        console.error("updateStatus:", err);
        return res.status(500).json({ success: false, error: "Erro ao atualizar status" });
    }
}

module.exports = { listBooks, getBook, createBook, updateBook, deleteBook, autocomplete, exportBooks, updateStatus };
