require("dotenv").config();
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

// Garantir que a pasta data existe
const dataDir = path.join(__dirname, "../../data");
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Garantir que a pasta uploads existe
const uploadsDir = path.join(__dirname, "../../uploads/covers");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH
    ? path.join(__dirname, "../../", process.env.DATABASE_PATH)
    : path.join(__dirname, "../../data/booklibrary.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ============================================================
// MIGRATIONS — criar todas as tabelas
// ============================================================
const migrate = db.transaction(() => {
    db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      owner_id        TEXT,
      plan            TEXT DEFAULT 'free',
      max_books       INTEGER DEFAULT 50,
      max_storage_mb  INTEGER DEFAULT 50,
      is_active       INTEGER DEFAULT 1,
      setup_completed INTEGER DEFAULT 1,
      created_at      TEXT DEFAULT (datetime('now')),
      expires_at      TEXT,
      stripe_customer_id TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      email           TEXT UNIQUE NOT NULL,
      password        TEXT NOT NULL,
      full_name       TEXT,
      avatar_path     TEXT,
      tenant_id       TEXT,
      is_active       INTEGER DEFAULT 1,
      is_master_admin INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      last_login_at   TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      name      TEXT NOT NULL,
      color     TEXT DEFAULT '#0d6efd',
      icon      TEXT DEFAULT 'fa-book',
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
    CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id);

    CREATE TABLE IF NOT EXISTS books (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id        TEXT NOT NULL,
      title            TEXT NOT NULL,
      author           TEXT NOT NULL,
      publisher        TEXT,
      publish_year     INTEGER,
      pages            INTEGER,
      isbn             TEXT,
      cdd              TEXT,
      cdu              TEXT,
      language         TEXT DEFAULT 'Português',
      edition          TEXT,
      volumes          INTEGER DEFAULT 1,
      synopsis         TEXT,
      cover_image_path TEXT,
      shelf_location   TEXT,
      category_id      INTEGER,
      copies           INTEGER DEFAULT 1,
      available_copies INTEGER DEFAULT 1,
      status           TEXT DEFAULT 'want_to_read',
      rating           INTEGER DEFAULT 0,
      is_featured      INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_books_tenant_id  ON books(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_books_status     ON books(status);
    CREATE INDEX IF NOT EXISTS idx_books_category   ON books(category_id);

    CREATE TABLE IF NOT EXISTS reading_progresses (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id    TEXT NOT NULL,
      book_id      INTEGER NOT NULL,
      start_date   TEXT,
      end_date     TEXT,
      current_page INTEGER DEFAULT 0,
      notes        TEXT,
      rating       INTEGER DEFAULT 0,
      is_reread    INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_reading_progresses_tenant_id ON reading_progresses(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_reading_progresses_book_id   ON reading_progresses(book_id);

    CREATE TABLE IF NOT EXISTS loans (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id      TEXT NOT NULL,
      book_id        INTEGER NOT NULL,
      borrower_name  TEXT NOT NULL,
      borrower_phone TEXT NOT NULL,
      loan_date      TEXT DEFAULT (datetime('now')),
      return_date    TEXT,
      is_returned    INTEGER DEFAULT 0,
      notes          TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    );
    CREATE INDEX IF NOT EXISTS idx_loans_tenant_id ON loans(tenant_id);

    CREATE TABLE IF NOT EXISTS achievements (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT NOT NULL,
      icon        TEXT DEFAULT '🏆',
      type        TEXT NOT NULL,
      requirement INTEGER NOT NULL,
      points      INTEGER NOT NULL,
      rarity      TEXT DEFAULT 'common',
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id      TEXT NOT NULL,
      user_id        TEXT NOT NULL,
      achievement_id INTEGER NOT NULL,
      unlocked_at    TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (achievement_id) REFERENCES achievements(id)
    );

    CREATE TABLE IF NOT EXISTS user_progresses (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id         TEXT NOT NULL,
      user_id           TEXT NOT NULL UNIQUE,
      user_name         TEXT DEFAULT 'Leitor',
      total_points      INTEGER DEFAULT 0,
      level             INTEGER DEFAULT 1,
      books_read        INTEGER DEFAULT 0,
      total_pages_read  INTEGER DEFAULT 0,
      current_streak    INTEGER DEFAULT 0,
      longest_streak    INTEGER DEFAULT 0,
      last_reading_date TEXT,
      yearly_goal       INTEGER DEFAULT 12,
      reviews_count     INTEGER DEFAULT 0,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reading_activities (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id        TEXT NOT NULL,
      user_progress_id INTEGER NOT NULL,
      book_id          INTEGER,
      activity_date    TEXT NOT NULL,
      pages_read       INTEGER DEFAULT 0,
      minutes_read     INTEGER,
      created_at       TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (user_progress_id) REFERENCES user_progresses(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id                     TEXT PRIMARY KEY,
      tenant_id              TEXT NOT NULL UNIQUE,
      stripe_subscription_id TEXT NOT NULL,
      stripe_customer_id     TEXT NOT NULL,
      plan                   TEXT NOT NULL,
      status                 TEXT DEFAULT 'trial',
      current_period_start   TEXT,
      current_period_end     TEXT,
      monthly_amount         REAL DEFAULT 0,
      currency               TEXT DEFAULT 'BRL',
      cancel_at_period_end   INTEGER DEFAULT 0,
      trial_end              TEXT,
      cancelled_at           TEXT,
      created_at             TEXT DEFAULT (datetime('now')),
      updated_at             TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id                       TEXT PRIMARY KEY,
      tenant_id                TEXT NOT NULL,
      subscription_id          TEXT,
      stripe_payment_intent_id TEXT NOT NULL,
      stripe_invoice_id        TEXT,
      amount                   REAL NOT NULL,
      currency                 TEXT DEFAULT 'BRL',
      status                   TEXT DEFAULT 'pending',
      payment_method           TEXT,
      last_4                   TEXT,
      card_brand               TEXT,
      description              TEXT,
      paid_at                  TEXT,
      failed_at                TEXT,
      failure_message          TEXT,
      invoice_url              TEXT,
      invoice_pdf_url          TEXT,
      created_at               TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS billing_addresses (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL UNIQUE,
      tax_id        TEXT NOT NULL,
      company_name  TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      city          TEXT NOT NULL,
      state         TEXT NOT NULL,
      postal_code   TEXT NOT NULL,
      country       TEXT DEFAULT 'BR',
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
  `);
});

// ============================================================
// SEED — conquistas padrão (27 conquistas completas)
// ============================================================
const seedAchievements = db.transaction(() => {
    const allAchievements = [
        // 📚 Livros Lidos (BooksRead)
        {
            name: "Primeiro Passo",
            description: "Leia seu primeiro livro",
            icon: "📖",
            type: "books_read",
            requirement: 1,
            points: 10,
            rarity: "common",
        },
        { name: "Leitor Iniciante", description: "Leia 5 livros", icon: "📚", type: "books_read", requirement: 5, points: 50, rarity: "common" },
        { name: "Leitor Regular", description: "Leia 10 livros", icon: "📗", type: "books_read", requirement: 10, points: 100, rarity: "rare" },
        { name: "Bibliófilo", description: "Leia 25 livros", icon: "📘", type: "books_read", requirement: 25, points: 250, rarity: "epic" },
        {
            name: "Mestre dos Livros",
            description: "Leia 50 livros",
            icon: "📕",
            type: "books_read",
            requirement: 50,
            points: 500,
            rarity: "legendary",
        },
        {
            name: "Lenda da Leitura",
            description: "Leia 100 livros",
            icon: "🏆",
            type: "books_read",
            requirement: 100,
            points: 1000,
            rarity: "legendary",
        },
        // 🏠 Biblioteca (BooksInLibrary)
        {
            name: "Colecionador Iniciante",
            description: "Tenha 10 livros na biblioteca",
            icon: "🏠",
            type: "books_in_library",
            requirement: 10,
            points: 30,
            rarity: "common",
        },
        {
            name: "Biblioteca Crescente",
            description: "Tenha 25 livros na biblioteca",
            icon: "🏛️",
            type: "books_in_library",
            requirement: 25,
            points: 75,
            rarity: "rare",
        },
        {
            name: "Curador",
            description: "Tenha 50 livros na biblioteca",
            icon: "📚",
            type: "books_in_library",
            requirement: 50,
            points: 150,
            rarity: "epic",
        },
        {
            name: "Biblioteca Real",
            description: "Tenha 100 livros na biblioteca",
            icon: "👑",
            type: "books_in_library",
            requirement: 100,
            points: 300,
            rarity: "legendary",
        },
        // 🔥 Sequência de Leitura (ReadingStreak)
        {
            name: "Consistência",
            description: "Leia por 3 dias consecutivos",
            icon: "🔥",
            type: "reading_streak",
            requirement: 3,
            points: 30,
            rarity: "common",
        },
        {
            name: "Uma Semana",
            description: "Leia por 7 dias consecutivos",
            icon: "⭐",
            type: "reading_streak",
            requirement: 7,
            points: 70,
            rarity: "rare",
        },
        {
            name: "Dedicação Total",
            description: "Leia por 30 dias consecutivos",
            icon: "💫",
            type: "reading_streak",
            requirement: 30,
            points: 300,
            rarity: "epic",
        },
        {
            name: "Inabalável",
            description: "Leia por 100 dias consecutivos",
            icon: "💎",
            type: "reading_streak",
            requirement: 100,
            points: 1000,
            rarity: "legendary",
        },
        // 📄 Páginas Lidas (PagesRead)
        {
            name: "100 Páginas",
            description: "Leia 100 páginas no total",
            icon: "📄",
            type: "pages_read",
            requirement: 100,
            points: 20,
            rarity: "common",
        },
        {
            name: "Devorador de Páginas",
            description: "Leia 1.000 páginas no total",
            icon: "📃",
            type: "pages_read",
            requirement: 1000,
            points: 100,
            rarity: "rare",
        },
        {
            name: "Maratonista",
            description: "Leia 5.000 páginas no total",
            icon: "🏃",
            type: "pages_read",
            requirement: 5000,
            points: 500,
            rarity: "epic",
        },
        {
            name: "Biblioteca Ambulante",
            description: "Leia 10.000 páginas no total",
            icon: "🌟",
            type: "pages_read",
            requirement: 10000,
            points: 1000,
            rarity: "legendary",
        },
        // 🎭 Explorador de Gêneros (GenreExplorer)
        {
            name: "Mente Aberta",
            description: "Leia livros de 3 categorias diferentes",
            icon: "🎭",
            type: "genre_explorer",
            requirement: 3,
            points: 50,
            rarity: "common",
        },
        {
            name: "Explorador Cultural",
            description: "Leia livros de 5 categorias diferentes",
            icon: "🌍",
            type: "genre_explorer",
            requirement: 5,
            points: 100,
            rarity: "rare",
        },
        {
            name: "Renascentista",
            description: "Leia livros de 10 categorias diferentes",
            icon: "🎨",
            type: "genre_explorer",
            requirement: 10,
            points: 200,
            rarity: "epic",
        },
        // ✍️ Avaliações (Reviewer)
        {
            name: "Primeira Opinião",
            description: "Avalie seu primeiro livro",
            icon: "✍️",
            type: "reviewer",
            requirement: 1,
            points: 10,
            rarity: "common",
        },
        { name: "Crítico Amador", description: "Avalie 10 livros", icon: "📝", type: "reviewer", requirement: 10, points: 100, rarity: "rare" },
        { name: "Crítico Profissional", description: "Avalie 25 livros", icon: "🎯", type: "reviewer", requirement: 25, points: 250, rarity: "epic" },
        // 🎯 Meta Anual (YearlyGoal) — requisito em percentual (50 = 50%, 100 = 100%)
        {
            name: "No Caminho Certo",
            description: "Alcance 50% da sua meta anual de leitura",
            icon: "🎯",
            type: "yearly_goal",
            requirement: 50,
            points: 100,
            rarity: "rare",
        },
        {
            name: "Meta Alcançada!",
            description: "Alcance 100% da sua meta anual de leitura",
            icon: "🏅",
            type: "yearly_goal",
            requirement: 100,
            points: 500,
            rarity: "epic",
        },
        // Bônus Lendário
        {
            name: "Lendário dos Livros",
            description: "Leia 1.000 livros — a conquista máxima!",
            icon: "🌠",
            type: "books_read",
            requirement: 1000,
            points: 5000,
            rarity: "legendary",
        },
    ];

    const stmt = db.prepare(`INSERT INTO achievements (name, description, icon, type, requirement, points, rarity) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const exists = db.prepare("SELECT id FROM achievements WHERE type = ? AND requirement = ?");

    let inserted = 0;
    for (const a of allAchievements) {
        if (!exists.get(a.type, a.requirement)) {
            stmt.run(a.name, a.description, a.icon, a.type, a.requirement, a.points, a.rarity);
            inserted++;
        }
    }

    // Remove a antiga "Meta Anual" com requirement=1 (substituída pela versão percentual)
    db.prepare(`DELETE FROM achievements WHERE type = 'yearly_goal' AND requirement = 1`).run();

    if (inserted > 0) console.log(`✅ ${inserted} conquistas inseridas/atualizadas!`);
});

// ============================================================
// SEED — Master Admin (criado apenas se não existir)
// ============================================================
const seedMasterAdmin = () => {
    const email = process.env.MASTER_ADMIN_EMAIL || "admin@booklibrary.com";
    const password = process.env.MASTER_ADMIN_PASSWORD || "Admin@123";
    const name = "Master Admin";
    const hash = bcrypt.hashSync(password, 12);

    const existing = db.prepare("SELECT id FROM users WHERE is_master_admin = 1 LIMIT 1").get();

    if (existing) {
        // Sincroniza email e senha com os valores atuais do .env
        db.prepare("UPDATE users SET email = ?, password = ? WHERE id = ?").run(email, hash, existing.id);
        console.log(`🔄 Master admin sincronizado — email: ${email}`);
        return;
    }

    const userId = uuidv4();
    const tenantId = uuidv4();

    const tx = db.transaction(() => {
        db.prepare(`INSERT INTO tenants (id, name, owner_id, plan, max_books, max_storage_mb) VALUES (?, ?, ?, 'master', 99999, 99999)`).run(
            tenantId,
            `Biblioteca de ${name}`,
            userId,
        );
        db.prepare(`INSERT INTO users (id, email, password, full_name, tenant_id, is_master_admin) VALUES (?, ?, ?, ?, ?, 1)`).run(
            userId,
            email,
            hash,
            name,
            tenantId,
        );
        db.prepare(`INSERT INTO user_progresses (tenant_id, user_id, user_name) VALUES (?, ?, ?)`).run(tenantId, userId, name);
    });
    tx();

    console.log(`✅ Master admin criado — email: ${email}`);
};

// ============================================================
// SAFE ALTER TABLE MIGRATIONS — adicionar colunas novas sem recriar tabelas
// ============================================================
function safeAddColumn(table, column, definition) {
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (e) {
        if (!e.message.includes("duplicate column name")) throw e;
    }
}

// Executar migrations e seed
try {
    migrate();

    // Colunas adicionadas em versões posteriores
    safeAddColumn("reading_progresses", "user_id", "TEXT REFERENCES users(id)");
    safeAddColumn("reading_progresses", "updated_at", "TEXT");
    safeAddColumn("user_achievements", "has_been_viewed", "INTEGER DEFAULT 0");
    safeAddColumn("books", "updated_at", "TEXT");

    // Backfill: preenche user_id nas leituras antigas que ficaram NULL (coluna adicionada após inserção)
    try {
        db.prepare(
            `UPDATE reading_progresses
             SET user_id = (SELECT owner_id FROM tenants WHERE tenants.id = reading_progresses.tenant_id)
             WHERE user_id IS NULL`,
        ).run();
    } catch (e) {
        console.warn("Backfill reading_progresses.user_id:", e.message);
    }

    // Backfill: popula reading_activities a partir de reading_progresses existentes
    try {
        db.prepare(
            `INSERT OR IGNORE INTO reading_activities (tenant_id, user_progress_id, book_id, activity_date, pages_read)
             SELECT
               rp.tenant_id,
               up.id,
               rp.book_id,
               COALESCE(rp.end_date, date('now')),
               CASE
                 WHEN rp.end_date IS NOT NULL THEN COALESCE(b.pages, 0)
                 ELSE COALESCE(rp.current_page, 0)
               END
             FROM reading_progresses rp
             JOIN books b ON b.id = rp.book_id
             JOIN user_progresses up ON up.user_id = rp.user_id AND up.tenant_id = rp.tenant_id
             WHERE rp.user_id IS NOT NULL
               AND CASE
                     WHEN rp.end_date IS NOT NULL THEN COALESCE(b.pages, 0)
                     ELSE COALESCE(rp.current_page, 0)
                   END > 0
               AND NOT EXISTS (
                 SELECT 1 FROM reading_activities ra2
                 WHERE ra2.user_progress_id = up.id
                   AND ra2.book_id = rp.book_id
                   AND ra2.activity_date = COALESCE(rp.end_date, date('now'))
               )`,
        ).run();
    } catch (e) {
        console.warn("Backfill reading_activities:", e.message);
    }

    // Billing — colunas adicionadas para suporte ao Stripe
    safeAddColumn("subscriptions", "is_trial_period", "INTEGER DEFAULT 0");
    safeAddColumn("subscriptions", "ended_at", "TEXT");

    seedAchievements();
    seedMasterAdmin();
    console.log("✅ Banco de dados inicializado com sucesso!");
} catch (err) {
    console.error("❌ Erro ao inicializar banco de dados:", err.message);
    process.exit(1);
}

module.exports = db;
