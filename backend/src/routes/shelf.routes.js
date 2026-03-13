const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const db = require("../config/database");

// GET /api/shelf?filter=reading|read|want_to_read|paused|loaned
router.get("/", auth, (req, res) => {
    try {
        const { filter } = req.query;
        let where = "tenant_id = ?";
        const params = [req.user.tenantId];

        if (filter === "loaned") {
            where += " AND b.available_copies < b.copies";
        } else if (["reading", "read", "want_to_read", "paused"].includes(filter)) {
            where += " AND b.status = ?";
            params.push(filter);
        }

        const books = db
            .prepare(
                `
            SELECT b.id, b.title, b.author, b.cover_image_path AS coverImagePath,
                   b.status, b.rating, b.is_featured AS isFeatured,
                   b.copies, b.available_copies AS availableCopies,
                   c.name AS categoryName
            FROM books b
            LEFT JOIN categories c ON c.id = b.category_id
            WHERE b.${where}
            ORDER BY b.created_at DESC
        `,
            )
            .all(...params);

        return res.json(books);
    } catch (err) {
        console.error("shelf:", err);
        return res.status(500).json({ error: "Erro ao carregar estante" });
    }
});

module.exports = router;
