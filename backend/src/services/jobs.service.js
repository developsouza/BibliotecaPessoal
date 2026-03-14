/**
 * jobs.service.js — Background Jobs via node-cron
 *
 * Três tarefas agendadas:
 *  1. CleanupOldCovers    — remove capas órfãs do disco
 *  2. BackupDatabase      — cópias de segurança do SQLite (mantém últimos 7)
 *  3. EnrichBooksAuto     — enriquece livros sem capa/páginas/ISBN via Google Books
 */
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const db = require("../config/database");

const COVERS_DIR = path.join(__dirname, "../../uploads/covers");
const DATA_DIR = path.join(__dirname, "../../data");
const BACKUP_DIR = path.join(DATA_DIR, "Backups");

// ─────────────────────────────────────────
// Utilitário: pad zero
// ─────────────────────────────────────────
function ts() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}

// ─────────────────────────────────────────
// 1. CleanupOldCovers
//    Todos os dias às 03:00
//    Remove arquivos em uploads/covers/ que:
//    - Não estão referenciados em nenhum livro, OU
//    - Não foram modificados nos últimos 365 dias (segurança extra)
// ─────────────────────────────────────────
function cleanupOldCovers() {
    try {
        if (!fs.existsSync(COVERS_DIR)) return;

        // Todos os cover_image_path registrados no banco
        const rows = db.prepare("SELECT cover_image_path FROM books WHERE cover_image_path IS NOT NULL").all();
        const registeredPaths = new Set(rows.map((r) => path.resolve(path.join(__dirname, "../../", r.cover_image_path))));

        const files = fs.readdirSync(COVERS_DIR);
        const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000; // 365 dias atrás
        let removed = 0;

        for (const file of files) {
            const filePath = path.join(COVERS_DIR, file);
            try {
                const stat = fs.statSync(filePath);
                if (!stat.isFile()) continue;

                const isOrphan = !registeredPaths.has(path.resolve(filePath));
                const isOld = stat.mtimeMs < cutoff;

                if (isOrphan || isOld) {
                    fs.unlinkSync(filePath);
                    removed++;
                }
            } catch {
                // ignora erros de arquivo individual
            }
        }

        if (removed > 0) {
            console.log(`[Jobs] CleanupOldCovers: ${removed} arquivo(s) removido(s)`);
        }
    } catch (err) {
        console.error("[Jobs] CleanupOldCovers erro:", err.message);
    }
}

// ─────────────────────────────────────────
// 2. BackupDatabase
//    Todos os dias às 02:00
//    Copia data/*.db para data/Backups/booklibrary_TIMESTAMP.db
//    Mantém apenas os últimos 7 backups
// ─────────────────────────────────────────
function backupDatabase() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        const dbFiles = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".db") && !f.startsWith("_"));
        for (const dbFile of dbFiles) {
            const src = path.join(DATA_DIR, dbFile);
            const baseName = dbFile.replace(".db", "");
            const dest = path.join(BACKUP_DIR, `${baseName}_${ts()}.db`);

            fs.copyFileSync(src, dest);
            console.log(`[Jobs] BackupDatabase: ${dest}`);
        }

        // Purgar backups além dos últimos 7 por prefixo
        const allBackups = fs
            .readdirSync(BACKUP_DIR)
            .filter((f) => f.endsWith(".db"))
            .map((f) => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime); // mais recente primeiro

        if (allBackups.length > 7) {
            const toDelete = allBackups.slice(7);
            for (const f of toDelete) {
                fs.unlinkSync(path.join(BACKUP_DIR, f.name));
            }
            console.log(`[Jobs] BackupDatabase: ${toDelete.length} backup(s) antigo(s) removido(s)`);
        }
    } catch (err) {
        console.error("[Jobs] BackupDatabase erro:", err.message);
    }
}

// ─────────────────────────────────────────
// 3. EnrichBooksAuto — DESATIVADO
//    O enriquecimento automático foi desabilitado para evitar consumo
//    desnecessário da cota da API do Google Books.
//    O usuário pode enriquecer livros manualmente na página de detalhes.
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// Registrar todos os jobs
// ─────────────────────────────────────────
function startJobs() {
    // Backup diário às 02:00
    cron.schedule("0 2 * * *", () => {
        console.log("[Jobs] Iniciando BackupDatabase...");
        backupDatabase();
    });

    // Limpeza de capas diária às 03:00
    cron.schedule("0 3 * * *", () => {
        console.log("[Jobs] Iniciando CleanupOldCovers...");
        cleanupOldCovers();
    });

    console.log("✅ Background jobs registrados (Backup 02:00 | Cleanup 03:00)");
}

module.exports = { startJobs, backupDatabase, cleanupOldCovers };
