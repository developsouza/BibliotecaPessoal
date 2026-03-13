const db = require("../config/database");
const { invalidateCache: invalidateDashCache } = require("./dashboard.controller");

function camelizeLoan(l) {
    if (!l) return null;
    return {
        id: l.id,
        bookId: l.book_id,
        borrowerName: l.borrower_name,
        borrowerPhone: l.borrower_phone,
        loanDate: l.loan_date,
        returnDate: l.return_date,
        isReturned: !!l.is_returned,
        notes: l.notes,
        // joined
        title: l.title,
        author: l.author,
        coverImagePath: l.coverImagePath,
    };
}

const JOIN_BOOKS = `
    LEFT JOIN books b ON b.id = l.book_id
`;
const SELECT = `
    l.*,
    b.title, b.author,
    b.cover_image_path AS coverImagePath
`;

// GET /api/loans?page=&pageSize=&active=
async function listLoans(req, res) {
    try {
        const { page = 1, pageSize = 20, active } = req.query;
        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;

        let where = "l.tenant_id = ?";
        const params = [req.user.tenantId];

        if (active === "true") {
            where += " AND l.is_returned = 0";
        } else if (active === "false") {
            where += " AND l.is_returned = 1";
        }

        const total = db.prepare(`SELECT COUNT(*) as cnt FROM loans l WHERE ${where}`).get(...params).cnt;

        const rows = db
            .prepare(
                `
            SELECT ${SELECT} FROM loans l ${JOIN_BOOKS}
            WHERE ${where}
            ORDER BY l.loan_date DESC
            LIMIT ? OFFSET ?
        `,
            )
            .all(...params, limit, offset);

        return res.json({ total, page: parseInt(page), pageSize: limit, data: rows.map(camelizeLoan) });
    } catch (err) {
        console.error("listLoans:", err);
        return res.status(500).json({ error: "Erro ao listar empréstimos" });
    }
}

// GET /api/loans/active
async function listActive(req, res) {
    try {
        const rows = db
            .prepare(
                `
            SELECT ${SELECT} FROM loans l ${JOIN_BOOKS}
            WHERE l.tenant_id = ? AND l.is_returned = 0
            ORDER BY l.loan_date ASC
        `,
            )
            .all(req.user.tenantId);
        return res.json(rows.map(camelizeLoan));
    } catch (err) {
        console.error("listActive:", err);
        return res.status(500).json({ error: "Erro ao listar empréstimos ativos" });
    }
}

// POST /api/loans
async function createLoan(req, res) {
    try {
        const { bookId, borrowerName, borrowerPhone, loanDate, notes } = req.body;

        if (!bookId || !borrowerName || !borrowerPhone) {
            return res.status(400).json({ error: "bookId, borrowerName e borrowerPhone são obrigatórios" });
        }

        const createLoanTx = db.transaction(() => {
            const book = db.prepare("SELECT * FROM books WHERE id = ? AND tenant_id = ?").get(bookId, req.user.tenantId);

            if (!book) throw Object.assign(new Error("Livro não encontrado"), { status: 404 });

            const availableCopies = book.available_copies ?? book.copies ?? 1;
            if (availableCopies <= 0) {
                throw Object.assign(new Error("Nenhum exemplar disponível"), { status: 400 });
            }

            // Decrementa cópias disponíveis
            db.prepare("UPDATE books SET available_copies = available_copies - 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(bookId);

            const today = loanDate || new Date().toISOString().slice(0, 10);
            const result = db
                .prepare(
                    `
                INSERT INTO loans (tenant_id, book_id, borrower_name, borrower_phone, loan_date, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
                )
                .run(req.user.tenantId, bookId, borrowerName, borrowerPhone, today, notes || null);

            return result.lastInsertRowid;
        });

        const loanId = createLoanTx();
        const loan = db.prepare(`SELECT ${SELECT} FROM loans l ${JOIN_BOOKS} WHERE l.id = ?`).get(loanId);
        invalidateDashCache(req.user.tenantId);
        return res.status(201).json(camelizeLoan(loan));
    } catch (err) {
        console.error("createLoan:", err);
        if (err.status) return res.status(err.status).json({ error: err.message });
        return res.status(500).json({ error: "Erro ao criar empréstimo" });
    }
}

// PUT /api/loans/:id/return
async function returnLoan(req, res) {
    try {
        const returnTx = db.transaction(() => {
            const loan = db.prepare("SELECT * FROM loans WHERE id = ? AND tenant_id = ?").get(req.params.id, req.user.tenantId);

            if (!loan) throw Object.assign(new Error("Empréstimo não encontrado"), { status: 404 });
            if (loan.is_returned) throw Object.assign(new Error("Empréstimo já devolvido"), { status: 400 });

            const today = new Date().toISOString().slice(0, 10);
            db.prepare("UPDATE loans SET is_returned = 1, return_date = ? WHERE id = ?").run(today, loan.id);

            // Incrementa cópias disponíveis
            db.prepare("UPDATE books SET available_copies = available_copies + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(loan.book_id);
        });

        returnTx();
        const loan = db.prepare(`SELECT ${SELECT} FROM loans l ${JOIN_BOOKS} WHERE l.id = ?`).get(req.params.id);
        invalidateDashCache(req.user.tenantId);
        return res.json(camelizeLoan(loan));
    } catch (err) {
        console.error("returnLoan:", err);
        if (err.status) return res.status(err.status).json({ error: err.message });
        return res.status(500).json({ error: "Erro ao registrar devolução" });
    }
}

// DELETE /api/loans/:id
async function deleteLoan(req, res) {
    try {
        const loan = db.prepare("SELECT * FROM loans WHERE id = ? AND tenant_id = ?").get(req.params.id, req.user.tenantId);

        if (!loan) return res.status(404).json({ error: "Empréstimo não encontrado" });

        db.prepare("DELETE FROM loans WHERE id = ?").run(req.params.id);
        invalidateDashCache(req.user.tenantId);
        return res.json({ message: "Empréstimo removido" });
    } catch (err) {
        console.error("deleteLoan:", err);
        return res.status(500).json({ error: "Erro ao excluir empréstimo" });
    }
}

module.exports = { listLoans, listActive, createLoan, returnLoan, deleteLoan };
