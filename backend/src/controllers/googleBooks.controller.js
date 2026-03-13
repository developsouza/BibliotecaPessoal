const axios = require("axios");
const db = require("../config/database");
const planFeature = require("../services/planFeature.service");
const { invalidateCache: invalidateDashCache } = require("./dashboard.controller");

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || "";
const GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1/volumes";

// Função utilitária para buscar na API do Google Books
async function fetchGoogleBooks(query) {
    const params = {
        q: query,
        maxResults: 40,
        printType: "books",
        orderBy: "relevance",
    };
    if (GOOGLE_BOOKS_API_KEY) {
        params.key = GOOGLE_BOOKS_API_KEY;
    }

    const response = await axios.get(GOOGLE_BOOKS_BASE_URL, {
        params,
        timeout: 10000,
    });
    return response.data;
}

// ─── Resolve ou cria categoria a partir dos dados do Google Books ───
// Mapa de tradução das categorias do Google Books (inglês → português BR)
const CATEGORY_TRANSLATIONS = {
    fiction: "Ficção",
    nonfiction: "Não Ficção",
    "non-fiction": "Não Ficção",
    "non fiction": "Não Ficção",
    "literary fiction": "Ficção Literária",
    "science fiction": "Ficção Científica",
    "sci-fi": "Ficção Científica",
    fantasy: "Fantasia",
    "fantasy fiction": "Fantasia",
    romance: "Romance",
    thriller: "Thriller",
    mystery: "Mistério",
    "mystery & detective": "Mistério",
    detective: "Policial",
    crime: "Crime",
    horror: "Terror",
    adventure: "Aventura",
    "adventure stories": "Aventura",
    biography: "Biografia",
    "biography & autobiography": "Biografia",
    autobiography: "Autobiografia",
    history: "História",
    "historical fiction": "Ficção Histórica",
    philosophy: "Filosofia",
    psychology: "Psicologia",
    "self-help": "Autoajuda",
    "self help": "Autoajuda",
    "personal development": "Desenvolvimento Pessoal",
    business: "Negócios",
    "business & economics": "Negócios e Economia",
    economics: "Economia",
    finance: "Finanças",
    management: "Administração",
    leadership: "Liderança",
    marketing: "Marketing",
    technology: "Tecnologia",
    computers: "Informática",
    "computer science": "Ciência da Computação",
    programming: "Programação",
    science: "Ciências",
    "social science": "Ciências Sociais",
    "political science": "Ciência Política",
    politics: "Política",
    religion: "Religião",
    spirituality: "Espiritualidade",
    education: "Educação",
    "juvenile fiction": "Juvenil",
    "juvenile nonfiction": "Juvenil Não Ficção",
    "young adult fiction": "Jovem Adulto",
    "young adult": "Jovem Adulto",
    children: "Infantil",
    comics: "Quadrinhos",
    "graphic novels": "Graphic Novel",
    poetry: "Poesia",
    drama: "Drama",
    art: "Arte",
    music: "Música",
    cooking: "Culinária",
    food: "Gastronomia",
    travel: "Viagem",
    sports: "Esportes",
    health: "Saúde",
    "health & fitness": "Saúde e Bem-Estar",
    medicine: "Medicina",
    nature: "Natureza",
    gardening: "Jardinagem",
    architecture: "Arquitetura",
    design: "Design",
    photography: "Fotografia",
    humor: "Humor",
    law: "Direito",
    "language arts": "Linguística",
    "literary collections": "Coletâneas Literárias",
    "literary criticism": "Crítica Literária",
    mathematics: "Matemática",
    physics: "Física",
    chemistry: "Química",
    biology: "Biologia",
    "environmental science": "Ciências Ambientais",
    geography: "Geografia",
    sociology: "Sociologia",
    anthropology: "Antropologia",
    classics: "Clássicos",
    mythology: "Mitologia",
    occult: "Ocultismo",
    "true crime": "Crime Real",
    suspense: "Suspense",
    action: "Ação",
    war: "Guerra",
    western: "Faroeste",
    "erotic fiction": "Ficção Erótica",
};

function translateCategory(name) {
    const lower = name.toLowerCase().trim();
    return CATEGORY_TRANSLATIONS[lower] || name;
}

function resolveOrCreateCategory(tenantId, googleCategories) {
    if (!googleCategories || googleCategories.length === 0) return null;

    const allCats = db.prepare("SELECT id, name FROM categories WHERE tenant_id = ?").all(tenantId);

    for (const gCat of googleCategories) {
        // Normaliza: pega somente a primeira parte antes de " / " (ex: "Fiction / Sci-Fi" → "Fiction")
        const normalized = gCat.split("/")[0].trim();
        if (!normalized) continue;

        // Traduz para português para comparação
        const translated = translateCategory(normalized);

        // Correspondência exata (case-insensitive) — testa tanto o original quanto a tradução
        const exact = allCats.find((c) => c.name.toLowerCase() === normalized.toLowerCase() || c.name.toLowerCase() === translated.toLowerCase());
        if (exact) return exact.id;

        // Correspondência parcial
        const partial = allCats.find(
            (c) =>
                normalized.toLowerCase().includes(c.name.toLowerCase()) ||
                c.name.toLowerCase().includes(normalized.toLowerCase()) ||
                translated.toLowerCase().includes(c.name.toLowerCase()) ||
                c.name.toLowerCase().includes(translated.toLowerCase()),
        );
        if (partial) return partial.id;
    }

    // Sem correspondência — cria automaticamente com nome traduzido para pt-BR
    const rawName = googleCategories[0].split("/")[0].trim();
    if (!rawName) return null;

    const newName = translateCategory(rawName);

    // Proteção contra criação duplicada por corrida
    const existing = db.prepare("SELECT id FROM categories WHERE tenant_id = ? AND LOWER(name) = LOWER(?)").get(tenantId, newName);
    if (existing) return existing.id;

    try {
        const result = db
            .prepare("INSERT INTO categories (tenant_id, name, color, icon) VALUES (?, ?, ?, ?)")
            .run(tenantId, newName, "#3b82f6", "fa-book");
        return result.lastInsertRowid || null;
    } catch {
        return null;
    }
}

function parseGoogleBook(volume) {
    const info = volume.volumeInfo || {};
    return {
        googleId: volume.id,
        title: info.title || "Sem título",
        author: (info.authors || []).join(", ") || "Desconhecido",
        publisher: info.publisher || "",
        publishYear: info.publishedDate ? parseInt(info.publishedDate.substring(0, 4)) : null,
        pages: info.pageCount || null,
        isbn:
            (info.industryIdentifiers || []).find((i) => i.type === "ISBN_13")?.identifier ||
            (info.industryIdentifiers || []).find((i) => i.type === "ISBN_10")?.identifier ||
            null,
        language: info.language || "pt",
        synopsis: info.description || "",
        coverUrl:
            info.imageLinks?.thumbnail?.replace("http://", "https://") ||
            info.imageLinks?.smallThumbnail?.replace("http://", "https://") ||
            // fallback: URL de capa direta pelo ID do volume (funciona mesmo sem imageLinks)
            `https://books.google.com/books/content?id=${volume.id}&printsec=frontcover&img=1&zoom=1&source=gbs_api`,
        categories: info.categories || [],
    };
}

// GET /api/google-books/search?q=...
const searchBooks = async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
        return res.status(400).json({ error: "Informe um termo de busca com pelo menos 2 caracteres" });
    }

    try {
        const data = await fetchGoogleBooks(q.trim());
        const items = (data.items || []).map(parseGoogleBook);
        return res.json({ items, total: data.totalItems || 0 });
    } catch (err) {
        const status = err.response?.status;
        console.error("Google Books API error:", err.message, "status:", status);

        if (status === 429) {
            return res.status(429).json({ error: "Cota da API do Google Books esgotada. Tente novamente mais tarde." });
        }
        if (status === 400) {
            return res.status(400).json({ error: "Termo de busca inválido para o Google Books." });
        }
        return res.status(502).json({ error: "Erro ao consultar o Google Books. Verifique sua conexão ou tente novamente." });
    }
};

// POST /api/google-books/import
const importBook = (req, res) => {
    const { tenantId } = req.user;
    const { title, author, publisher, publishYear, pages, isbn, language, synopsis, coverUrl, categoryId, googleCategories } = req.body;

    if (!title || !author) {
        return res.status(400).json({ error: "Título e autor são obrigatórios" });
    }

    // Verificar limite do plano
    const tenant = db.prepare("SELECT max_books FROM tenants WHERE id = ?").get(tenantId);
    const bookCount = db.prepare("SELECT COUNT(*) as c FROM books WHERE tenant_id = ?").get(tenantId);
    if (tenant && bookCount.c >= tenant.max_books) {
        return res.status(403).json({
            error: "Limite de livros atingido para o seu plano",
            upgradeUrl: "/billing",
        });
    }

    // Verificar duplicidade por ISBN
    if (isbn) {
        const normalizedIsbn = isbn.replace(/[-\s]/g, "");
        const existing = db
            .prepare("SELECT id, title, author FROM books WHERE tenant_id = ? AND REPLACE(REPLACE(isbn, '-', ''), ' ', '') = ?")
            .get(tenantId, normalizedIsbn);
        if (existing) {
            return res.status(409).json({
                error: "Livro já existe na biblioteca (mesmo ISBN)",
                existingBook: { id: existing.id, title: existing.title, author: existing.author },
            });
        }
    }

    // Resolve categoria: usa o categoryId enviado ou tenta detectar pelas categorias do Google Books
    const resolvedCategoryId = categoryId || resolveOrCreateCategory(tenantId, googleCategories || []);

    try {
        const result = db
            .prepare(
                `
      INSERT INTO books
        (tenant_id, title, author, publisher, publish_year, pages, isbn,
         language, synopsis, cover_image_path, category_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'want_to_read')
    `,
            )
            .run(
                tenantId,
                title,
                author,
                publisher || null,
                publishYear || null,
                pages || null,
                isbn || null,
                language || "Português",
                synopsis || null,
                coverUrl || null,
                resolvedCategoryId || null,
            );

        const book = db.prepare("SELECT * FROM books WHERE id = ?").get(result.lastInsertRowid);
        invalidateDashCache(tenantId);
        return res.status(201).json({ success: true, book });
    } catch (err) {
        console.error("Import book error:", err.message);
        return res.status(500).json({ error: "Erro ao importar livro" });
    }
};

// Busca um volume específico por ID do Google Books
async function fetchGoogleBookById(googleBookId) {
    const url = `${GOOGLE_BOOKS_BASE_URL}/${encodeURIComponent(googleBookId)}`;
    const params = {};
    if (GOOGLE_BOOKS_API_KEY) params.key = GOOGLE_BOOKS_API_KEY;

    const response = await axios.get(url, { params, timeout: 10000 });
    return response.data;
}

// POST /api/google-books/enrich/:id
// Enriquece dados de um livro existente com informações do Google Books
const enrichBook = async (req, res) => {
    const { tenantId } = req.user;
    const bookId = +req.params.id;

    const book = db.prepare("SELECT * FROM books WHERE id = ? AND tenant_id = ?").get(bookId, tenantId);
    if (!book) return res.status(404).json({ error: "Livro não encontrado" });

    // ── Tenta buscar o volume no Google Books com múltiplos fallbacks ──
    async function tryFetchVolume() {
        // 1) ISBN
        if (book.isbn) {
            try {
                const normalizedIsbn = book.isbn.replace(/[-\s]/g, "");
                const r = await fetchGoogleBooks(`isbn:${normalizedIsbn}`);
                if (r.items?.length > 0) return r.items[0];
            } catch {
                /* ignora, continua */
            }
        }

        // 2) intitle + inauthor (operadores estruturados)
        try {
            const q = `intitle:"${book.title}" inauthor:"${book.author}"`;
            const r = await fetchGoogleBooks(q);
            if (r.items?.length > 0) return r.items[0];
        } catch {
            /* ignora, continua */
        }

        // 3) Busca simples sem operadores (mais tolerante a títulos com caracteres especiais)
        try {
            const q = `${book.title} ${book.author}`;
            const r = await fetchGoogleBooks(q);
            if (r.items?.length > 0) return r.items[0];
        } catch {
            /* ignora, continua */
        }

        // 4) Só o título, sem o autor
        try {
            const r = await fetchGoogleBooks(book.title);
            if (r.items?.length > 0) return r.items[0];
        } catch {
            /* ignora, continua */
        }

        return null;
    }

    try {
        const googleVolume = await tryFetchVolume();

        if (!googleVolume) {
            return res.status(404).json({ message: "Nenhum resultado encontrado no Google Books para este livro" });
        }

        const parsed = parseGoogleBook(googleVolume);

        // Só preenche campos que estão vazios no livro atual (não sobrescreve dados manuais)
        const updates = {};
        if (!book.publisher && parsed.publisher) updates.publisher = parsed.publisher;
        if (!book.publish_year && parsed.publishYear) updates.publish_year = parsed.publishYear;
        if (!book.pages && parsed.pages) updates.pages = parsed.pages;
        if (!book.isbn && parsed.isbn) updates.isbn = parsed.isbn;
        if (!book.language && parsed.language) updates.language = parsed.language;
        if (!book.synopsis && parsed.synopsis) updates.synopsis = parsed.synopsis;
        if (!book.cover_image_path && parsed.coverUrl) updates.cover_image_path = parsed.coverUrl;
        if (!book.category_id && parsed.categories?.length > 0) {
            const resolvedCatId = resolveOrCreateCategory(tenantId, parsed.categories);
            if (resolvedCatId) updates.category_id = resolvedCatId;
        }

        if (Object.keys(updates).length === 0) {
            return res.json({ message: "O livro já possui todos os dados preenchidos", book });
        }

        const setClauses = Object.keys(updates)
            .map((k) => `${k} = ?`)
            .join(", ");
        const values = [...Object.values(updates), bookId, tenantId];
        db.prepare(`UPDATE books SET ${setClauses} WHERE id = ? AND tenant_id = ?`).run(...values);

        const updated = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId);
        invalidateDashCache(tenantId);
        return res.json({
            message: `${Object.keys(updates).length} campo(s) enriquecido(s) com sucesso`,
            book: updated,
            enrichedFields: Object.keys(updates),
        });
    } catch (err) {
        console.error("enrichBook unexpected error:", err.message);
        return res.status(500).json({ error: "Erro interno ao tentar enriquecer o livro" });
    }
};

module.exports = { searchBooks, importBook, enrichBook };
