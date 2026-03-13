const db = require("../config/database");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const planFeature = require("../services/planFeature.service");

// Garantir que a coluna invite_code existe (migração segura)
try {
    db.exec("ALTER TABLE tenants ADD COLUMN invite_code TEXT");
} catch {
    // coluna já existe — ignora
}

// Gerar código de convite amigável (8 chars uppercase alfanumérico)
function generateInviteCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// Obter (ou criar) código de convite do tenant
function getOrCreateInviteCode(tenantId) {
    const tenant = db.prepare("SELECT invite_code FROM tenants WHERE id = ?").get(tenantId);
    if (tenant?.invite_code) return tenant.invite_code;

    let code;
    let attempts = 0;
    do {
        code = generateInviteCode();
        attempts++;
    } while (db.prepare("SELECT id FROM tenants WHERE invite_code = ?").get(code) && attempts < 20);

    db.prepare("UPDATE tenants SET invite_code = ? WHERE id = ?").run(code, tenantId);
    return code;
}

/**
 * Calcula o espaço ocupado em bytes pelos uploads/covers do tenant.
 * Como os arquivos são compartilhados no mesmo diretório, varremos todos
 * e usamos como proxy o tamanho total da pasta (conservador).
 */
function getTenantStorageBytes(tenantId) {
    try {
        const coversDir = path.join(__dirname, "../../uploads/covers");
        if (!fs.existsSync(coversDir)) return 0;

        // Buscar todos os cover_image_path do tenant
        const rows = db.prepare("SELECT cover_image_path FROM books WHERE tenant_id = ? AND cover_image_path IS NOT NULL").all(tenantId);

        let totalBytes = 0;
        for (const row of rows) {
            const filePath = path.join(__dirname, "../../", row.cover_image_path);
            try {
                const stat = fs.statSync(filePath);
                totalBytes += stat.size;
            } catch {
                // arquivo não existe no disco — ignora
            }
        }
        return totalBytes;
    } catch {
        return 0;
    }
}

// GET /api/tenant/usage
const getTenantUsage = (req, res) => {
    try {
        const { tenantId, plan } = req.user;
        const limits = planFeature.getLimits(plan);

        // Contagem de livros
        const booksUsed = db.prepare("SELECT COUNT(*) AS cnt FROM books WHERE tenant_id = ?").get(tenantId)?.cnt || 0;
        const maxBooks = limits.maxBooks === Infinity ? 99999 : limits.maxBooks;

        // Armazenamento
        const storageUsedBytes = getTenantStorageBytes(tenantId);
        const storageUsedMB = Math.round((storageUsedBytes / (1024 * 1024)) * 100) / 100;
        const maxStorageMB = limits.maxStorageMB === Infinity ? 99999 : limits.maxStorageMB;

        // Features habilitadas pelo plano
        const features = {
            exportData: limits.canExportData,
            googleBooks: limits.canUseGoogleBooks,
            advancedStats: limits.canUseAdvancedStats,
            streakHistory: limits.canViewStreakHistory,
            maxNotesLength: limits.maxNotesLength === Infinity ? 99999 : limits.maxNotesLength,
            maxReadingHistory: limits.maxReadingHistoryVisible === Infinity ? 99999 : limits.maxReadingHistoryVisible,
            maxAchievements: limits.maxAchievementsVisible === Infinity ? 99999 : limits.maxAchievementsVisible,
        };

        // Info do tenant
        const tenant = db.prepare("SELECT name, plan FROM tenants WHERE id = ?").get(tenantId);

        return res.json({
            tenant: { name: tenant?.name || "", plan: tenant?.plan || plan },
            books: {
                used: booksUsed,
                max: maxBooks,
                percentUsed: maxBooks >= 99999 ? 0 : Math.round((booksUsed / maxBooks) * 100),
            },
            storage: {
                usedMB: storageUsedMB,
                usedBytes: storageUsedBytes,
                maxMB: maxStorageMB,
                percentUsed: maxStorageMB >= 99999 ? 0 : Math.min(100, Math.round((storageUsedMB / maxStorageMB) * 100)),
            },
            features,
        });
    } catch (err) {
        console.error("getTenantUsage:", err);
        return res.status(500).json({ error: "Erro ao buscar uso do tenant" });
    }
};

// GET /api/tenant/setup
const getTenantSetup = (req, res) => {
    try {
        const { tenantId, id: userId } = req.user;
        const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(tenantId);
        if (!tenant) return res.status(404).json({ error: "Organização não encontrada" });

        const inviteCode = getOrCreateInviteCode(tenantId);
        const memberCount = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE tenant_id = ? AND is_active = 1").get(tenantId)?.cnt || 0;
        const isOwner = tenant.owner_id === userId;

        return res.json({
            tenantId: tenant.id,
            tenantName: tenant.name,
            plan: tenant.plan,
            inviteCode,
            memberCount,
            isOwner,
            setupCompleted: !!tenant.setup_completed,
            createdAt: tenant.created_at,
        });
    } catch (err) {
        console.error("getTenantSetup:", err);
        return res.status(500).json({ error: "Erro ao buscar configurações da organização" });
    }
};

// POST /api/tenant/join  { inviteCode }
const joinTenant = (req, res) => {
    try {
        const { inviteCode } = req.body;
        const { id: userId, tenantId: currentTenantId } = req.user;

        if (!inviteCode || !inviteCode.trim()) {
            return res.status(400).json({ error: "Código de convite é obrigatório" });
        }

        const targetTenant = db.prepare("SELECT * FROM tenants WHERE invite_code = ?").get(inviteCode.trim().toUpperCase());
        if (!targetTenant) {
            return res.status(404).json({ error: "Código de convite inválido ou expirado" });
        }

        if (targetTenant.id === currentTenantId) {
            return res.status(400).json({ error: "Você já pertence a esta organização" });
        }

        if (!targetTenant.is_active) {
            return res.status(403).json({ error: "Esta organização está desativada" });
        }

        // Verificar se o usuário já tem livros — não migra livros automaticamente
        const booksCount = db.prepare("SELECT COUNT(*) AS cnt FROM books WHERE tenant_id = ?").get(currentTenantId)?.cnt || 0;
        if (booksCount > 0) {
            return res.status(409).json({
                error: "Você já possui livros na sua biblioteca. Exporte seus dados antes de entrar em outra organização.",
                booksCount,
            });
        }

        // Migrar o usuário para o novo tenant
        db.prepare("UPDATE users SET tenant_id = ? WHERE id = ?").run(targetTenant.id, userId);

        // Atualizar progresso de gamificação se existir
        db.prepare("UPDATE user_progresses SET tenant_id = ? WHERE user_id = ?").run(targetTenant.id, userId);

        return res.json({
            message: `Você entrou na organização "${targetTenant.name}" com sucesso!`,
            tenantId: targetTenant.id,
            tenantName: targetTenant.name,
            plan: targetTenant.plan,
        });
    } catch (err) {
        console.error("joinTenant:", err);
        return res.status(500).json({ error: "Erro ao entrar na organização" });
    }
};

// PATCH /api/tenant/setup  { tenantName }
const updateTenantSetup = (req, res) => {
    try {
        const { tenantId, id: userId } = req.user;
        const { tenantName } = req.body;

        const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(tenantId);
        if (!tenant) return res.status(404).json({ error: "Organização não encontrada" });

        if (tenant.owner_id !== userId) {
            return res.status(403).json({ error: "Apenas o proprietário pode alterar o nome da organização" });
        }

        if (!tenantName || !tenantName.trim()) {
            return res.status(400).json({ error: "Nome da organização é obrigatório" });
        }

        db.prepare("UPDATE tenants SET name = ?, setup_completed = 1 WHERE id = ?").run(tenantName.trim(), tenantId);

        return res.json({ message: "Organização atualizada com sucesso", tenantName: tenantName.trim() });
    } catch (err) {
        console.error("updateTenantSetup:", err);
        return res.status(500).json({ error: "Erro ao atualizar organização" });
    }
};

// POST /api/tenant/regenerate-invite
const regenerateInviteCode = (req, res) => {
    try {
        const { tenantId, id: userId } = req.user;
        const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(tenantId);

        if (!tenant) return res.status(404).json({ error: "Organização não encontrada" });
        if (tenant.owner_id !== userId) return res.status(403).json({ error: "Apenas o proprietário pode regenerar o código" });

        let code;
        let attempts = 0;
        do {
            code = generateInviteCode();
            attempts++;
        } while (db.prepare("SELECT id FROM tenants WHERE invite_code = ?").get(code) && attempts < 20);

        db.prepare("UPDATE tenants SET invite_code = ? WHERE id = ?").run(code, tenantId);

        return res.json({ inviteCode: code });
    } catch (err) {
        console.error("regenerateInviteCode:", err);
        return res.status(500).json({ error: "Erro ao regenerar código de convite" });
    }
};

module.exports = { getTenantUsage, getTenantSetup, joinTenant, updateTenantSetup, regenerateInviteCode };
