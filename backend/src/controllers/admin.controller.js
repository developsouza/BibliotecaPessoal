const db = require("../config/database");
const paymentService = require("../services/payment.service");

// GET /api/admin/dashboard — Métricas globais
const getAdminDashboard = (req, res) => {
    const totalTenants = db.prepare("SELECT COUNT(*) as c FROM tenants WHERE is_active = 1").get().c;
    const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE is_active = 1").get().c;
    const totalBooks = db.prepare("SELECT COUNT(*) as c FROM books").get().c;
    const totalLoans = db.prepare("SELECT COUNT(*) as c FROM loans").get().c;
    const activeLoans = db.prepare("SELECT COUNT(*) as c FROM loans WHERE is_returned = 0").get().c;
    const totalReadings = db.prepare("SELECT COUNT(*) as c FROM reading_progresses WHERE end_date IS NOT NULL").get().c;

    // Assinaturas por status
    const activeSubscriptions = db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'active'").get().c;
    const trialSubscriptions = db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'trial'").get().c;
    const cancelledSubscriptions = db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE status IN ('cancelled','ended')").get().c;
    const pastDueSubscriptions = db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'past_due'").get().c;

    // Receita total (pagamentos com status paid/succeeded)
    const revenueRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status IN ('paid','succeeded')").get();
    const totalRevenue = revenueRow.total || 0;

    // Receita do mês atual
    const monthRevenueRow = db
        .prepare(
            `SELECT COALESCE(SUM(amount), 0) as total FROM payments
             WHERE status IN ('paid','succeeded')
             AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`,
        )
        .get();
    const monthRevenue = monthRevenueRow.total || 0;

    // Distribuição por plano
    const planDistribution = db
        .prepare(
            `
    SELECT plan, COUNT(*) as count FROM tenants WHERE is_active = 1
    GROUP BY plan ORDER BY count DESC
  `,
        )
        .all();

    // Registros por mês (últimos 6 meses)
    const monthlyGrowth = db
        .prepare(
            `
    SELECT
      strftime('%Y-%m', created_at) AS month,
      COUNT(*) AS new_tenants
    FROM tenants
    WHERE created_at >= datetime('now', '-6 months')
    GROUP BY month
    ORDER BY month
  `,
        )
        .all();

    // Receita mensal (últimos 6 meses)
    const monthlyRevenue = db
        .prepare(
            `
    SELECT
      strftime('%Y-%m', created_at) AS month,
      COALESCE(SUM(amount), 0) AS revenue
    FROM payments
    WHERE status IN ('paid','succeeded')
      AND created_at >= datetime('now', '-6 months')
    GROUP BY month
    ORDER BY month
  `,
        )
        .all();

    // Tenants recentes (últimos 8)
    const recentTenants = db
        .prepare(
            `
    SELECT t.id, t.name, t.plan, t.is_active, t.created_at,
           u.email AS owner_email, u.full_name AS owner_name
    FROM tenants t
    LEFT JOIN users u ON u.id = t.owner_id
    ORDER BY t.created_at DESC
    LIMIT 8
  `,
        )
        .all();

    return res.json({
        totals: { totalTenants, totalUsers, totalBooks, totalLoans, activeLoans, totalReadings },
        subscriptionStats: { activeSubscriptions, trialSubscriptions, cancelledSubscriptions, pastDueSubscriptions },
        revenue: { totalRevenue, monthRevenue },
        planDistribution,
        monthlyGrowth,
        monthlyRevenue,
        recentTenants,
    });
};

// GET /api/admin/tenants?page=1&limit=20&plan=&search=
const getTenants = (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const plan = req.query.plan || null;
    const search = req.query.search || null;

    let where = "WHERE 1=1";
    const params = [];

    if (plan) {
        where += " AND t.plan = ?";
        params.push(plan);
    }
    if (search) {
        where += " AND (t.name LIKE ? OR u.email LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
    }

    const total = db
        .prepare(
            `
    SELECT COUNT(DISTINCT t.id) as c
    FROM tenants t
    LEFT JOIN users u ON u.id = t.owner_id
    ${where}
  `,
        )
        .get(...params).c;

    const tenants = db
        .prepare(
            `
    SELECT
      t.*,
      u.email AS owner_email,
      u.full_name AS owner_name,
      (SELECT COUNT(*) FROM books WHERE tenant_id = t.id) AS books_count,
      (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND is_active = 1) AS users_count
    FROM tenants t
    LEFT JOIN users u ON u.id = t.owner_id
    ${where}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `,
        )
        .all(...params, limit, offset);

    return res.json({
        tenants,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
};

// GET /api/admin/tenants/:id
const getTenantDetail = (req, res) => {
    const { id } = req.params;

    const tenant = db
        .prepare(
            `
    SELECT t.*, u.email AS owner_email, u.full_name AS owner_name
    FROM tenants t LEFT JOIN users u ON u.id = t.owner_id
    WHERE t.id = ?
  `,
        )
        .get(id);

    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

    const stats = {
        books: db.prepare("SELECT COUNT(*) as c FROM books WHERE tenant_id = ?").get(id).c,
        users: db.prepare("SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND is_active = 1").get(id).c,
        readings: db.prepare("SELECT COUNT(*) as c FROM reading_progresses WHERE tenant_id = ?").get(id).c,
        loans: db.prepare("SELECT COUNT(*) as c FROM loans WHERE tenant_id = ?").get(id).c,
    };

    const users = db
        .prepare(
            `
    SELECT id, email, full_name, is_active, created_at, last_login_at
    FROM users WHERE tenant_id = ? ORDER BY created_at DESC
  `,
        )
        .all(id);

    const subscription = paymentService.getSubscription(id);
    const payments = paymentService.getPaymentHistory(id);

    return res.json({ tenant, stats, users, subscription, payments });
};

// PUT /api/admin/tenants/:id — editar dados básicos
const updateTenant = (req, res) => {
    const { id } = req.params;
    const { name, isActive } = req.body;

    const tenant = db.prepare("SELECT id FROM tenants WHERE id = ?").get(id);
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

    const updates = [];
    const params = [];
    if (name !== undefined) {
        updates.push("name = ?");
        params.push(name);
    }
    if (isActive !== undefined) {
        updates.push("is_active = ?");
        params.push(isActive ? 1 : 0);
    }

    if (!updates.length) return res.status(400).json({ error: "Nenhum campo para atualizar" });

    params.push(id);
    db.prepare(`UPDATE tenants SET ${updates.join(", ")} WHERE id = ?`).run(...params);

    return res.json({ success: true });
};

// PUT /api/admin/tenants/:id/plan — alterar plano + max_books
const updateTenantPlan = (req, res) => {
    const { id } = req.params;
    const { plan, maxBooks } = req.body;

    const validPlans = ["free", "premium", "pro", "master"];
    if (!plan || !validPlans.includes(plan)) {
        return res.status(400).json({ error: "Plano inválido", validPlans });
    }

    const tenant = db.prepare("SELECT id FROM tenants WHERE id = ?").get(id);
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

    const planDefaults = { free: 50, premium: 500, pro: 2000, master: 99999 };
    const newMaxBooks = maxBooks || planDefaults[plan];

    // Atualizar tenant
    db.prepare("UPDATE tenants SET plan = ?, max_books = ? WHERE id = ?").run(plan, newMaxBooks, id);

    // Nota: o plano no JWT será atualizado no próximo login do usuário

    return res.json({ success: true, plan, maxBooks: newMaxBooks });
};

// POST /api/admin/tenants — criar tenant
const createTenant = (req, res) => {
    const { name, plan, isActive, maxBooks, maxStorageMB, expiresAt } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ errors: { name: "Nome é obrigatório" } });
    if (name.trim().length > 200) return res.status(400).json({ errors: { name: "Nome deve ter no máximo 200 caracteres" } });

    const validPlans = ["free", "premium", "pro", "master"];
    if (!plan || !validPlans.includes(plan)) return res.status(400).json({ errors: { plan: "Plano inválido" } });

    const planDefaults = { free: 50, premium: 500, pro: 2000, master: 99999 };
    const finalMaxBooks = maxBooks && maxBooks > 0 ? parseInt(maxBooks) : planDefaults[plan];
    const finalMaxStorageMB = maxStorageMB && maxStorageMB > 0 ? parseInt(maxStorageMB) : planDefaults[plan];

    if (finalMaxBooks < 1) return res.status(400).json({ errors: { maxBooks: "Máximo de livros deve ser maior que 0" } });
    if (finalMaxStorageMB < 1) return res.status(400).json({ errors: { maxStorageMB: "Máximo de armazenamento deve ser maior que 0" } });

    const { randomUUID } = require("crypto");
    const id = randomUUID();
    const now = new Date().toISOString();
    const active = isActive !== false ? 1 : 0;
    const expiry = expiresAt || null;

    db.prepare(
        `INSERT INTO tenants (id, name, plan, max_books, max_storage_mb, is_active, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name.trim(), plan, finalMaxBooks, finalMaxStorageMB, active, now, expiry);

    const created = db.prepare("SELECT * FROM tenants WHERE id = ?").get(id);
    return res.status(201).json(created);
};

// PATCH /api/admin/tenants/:id/toggle-active — ativar/desativar
const toggleActiveTenant = (req, res) => {
    const { id } = req.params;

    const tenant = db.prepare("SELECT id, name, plan, is_active FROM tenants WHERE id = ?").get(id);
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

    if (tenant.plan === "master") return res.status(403).json({ error: "Não é possível desativar a biblioteca master!" });

    const newActive = tenant.is_active ? 0 : 1;
    db.prepare("UPDATE tenants SET is_active = ? WHERE id = ?").run(newActive, id);

    return res.json({
        id: tenant.id,
        name: tenant.name,
        isActive: newActive === 1,
        message: newActive ? "Biblioteca ativada com sucesso" : "Biblioteca desativada com sucesso",
    });
};

// DELETE /api/admin/tenants/:id — hard delete em cascata
const deleteTenant = (req, res) => {
    const { id } = req.params;

    const tenant = db.prepare("SELECT id, name, plan, owner_id FROM tenants WHERE id = ?").get(id);
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

    if (tenant.plan === "master") return res.status(403).json({ error: "Não é possível deletar a biblioteca master!" });

    try {
        db.transaction(() => {
            // 1. Reading activities
            const progresses = db.prepare("SELECT id FROM user_progresses WHERE tenant_id = ?").all(id);
            for (const p of progresses) {
                db.prepare("DELETE FROM reading_activities WHERE user_progress_id = ?").run(p.id);
            }
            // 2. User achievements
            db.prepare("DELETE FROM user_achievements WHERE tenant_id = ?").run(id);
            // 3. User progresses
            db.prepare("DELETE FROM user_progresses WHERE tenant_id = ?").run(id);
            // 4. Reading progresses
            db.prepare("DELETE FROM reading_progresses WHERE tenant_id = ?").run(id);
            // 5. Loans
            db.prepare("DELETE FROM loans WHERE tenant_id = ?").run(id);
            // 6. Books
            db.prepare("DELETE FROM books WHERE tenant_id = ?").run(id);
            // 7. Categories
            db.prepare("DELETE FROM categories WHERE tenant_id = ?").run(id);
            // 8. Payments
            db.prepare("DELETE FROM payments WHERE tenant_id = ?").run(id);
            // 9. Subscription
            db.prepare("DELETE FROM subscriptions WHERE tenant_id = ?").run(id);
            // 10. Billing address
            db.prepare("DELETE FROM billing_addresses WHERE tenant_id = ?").run(id);
            // 11. Owner user
            if (tenant.owner_id) {
                db.prepare("DELETE FROM users WHERE id = ?").run(tenant.owner_id);
            }
            // 12. Tenant
            db.prepare("DELETE FROM tenants WHERE id = ?").run(id);
        })();

        return res.json({ message: `Biblioteca '${tenant.name}' e proprietário foram deletados com sucesso!` });
    } catch (err) {
        return res.status(500).json({ error: `Erro ao deletar tenant: ${err.message}` });
    }
};

module.exports = {
    getAdminDashboard,
    getTenants,
    getTenantDetail,
    updateTenant,
    updateTenantPlan,
    createTenant,
    toggleActiveTenant,
    deleteTenant,
};
