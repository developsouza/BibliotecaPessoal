const db = require("../config/database");

// GET /api/categories
function listCategories(req, res) {
    try {
        const rows = db
            .prepare(
                `
      SELECT c.*, COUNT(b.id) AS book_count
      FROM categories c
      LEFT JOIN books b ON b.category_id = c.id AND b.tenant_id = c.tenant_id
      WHERE c.tenant_id = ?
      GROUP BY c.id
      ORDER BY c.name ASC
    `,
            )
            .all(req.user.tenantId);

        return res.json(
            rows.map((r) => ({
                id: r.id,
                name: r.name,
                color: r.color,
                icon: r.icon,
                bookCount: r.book_count,
            })),
        );
    } catch (err) {
        return res.status(500).json({ error: "Erro ao listar categorias" });
    }
}

// POST /api/categories
function createCategory(req, res) {
    try {
        const { name, color = "#0d6efd", icon = "fa-book" } = req.body;
        if (!name) return res.status(400).json({ error: "Nome é obrigatório" });

        const existing = db.prepare("SELECT id FROM categories WHERE tenant_id = ? AND name = ?").get(req.user.tenantId, name);
        if (existing) return res.status(409).json({ error: "Categoria já existe com este nome" });

        const { lastInsertRowid } = db
            .prepare("INSERT INTO categories (tenant_id, name, color, icon) VALUES (?, ?, ?, ?)")
            .run(req.user.tenantId, name, color, icon);

        return res.status(201).json({ id: lastInsertRowid, name, color, icon, bookCount: 0 });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao criar categoria" });
    }
}

// PUT /api/categories/:id
function updateCategory(req, res) {
    try {
        const cat = db.prepare("SELECT * FROM categories WHERE id = ? AND tenant_id = ?").get(+req.params.id, req.user.tenantId);
        if (!cat) return res.status(404).json({ error: "Categoria não encontrada" });

        const { name, color, icon } = req.body;
        db.prepare("UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ? AND tenant_id = ?").run(
            name ?? cat.name,
            color ?? cat.color,
            icon ?? cat.icon,
            +req.params.id,
            req.user.tenantId,
        );

        return res.json({ id: cat.id, name: name ?? cat.name, color: color ?? cat.color, icon: icon ?? cat.icon });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao editar categoria" });
    }
}

// DELETE /api/categories/:id
function deleteCategory(req, res) {
    try {
        const cat = db.prepare("SELECT id FROM categories WHERE id = ? AND tenant_id = ?").get(+req.params.id, req.user.tenantId);
        if (!cat) return res.status(404).json({ error: "Categoria não encontrada" });

        db.prepare("DELETE FROM categories WHERE id = ? AND tenant_id = ?").run(+req.params.id, req.user.tenantId);
        return res.json({ message: "Categoria excluída" });
    } catch (err) {
        return res.status(500).json({ error: "Erro ao excluir categoria" });
    }
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
