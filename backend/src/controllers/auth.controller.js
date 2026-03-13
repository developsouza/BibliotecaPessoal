const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");

function generateToken(user, tenant) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            tenantId: tenant.id,
            plan: tenant.plan,
            isMasterAdmin: !!user.is_master_admin,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );
}

// POST /api/auth/register
async function register(req, res) {
    try {
        const { email, password, fullName } = req.body;

        if (!email || !password || !fullName) {
            return res.status(400).json({ error: "Email, senha e nome são obrigatórios" });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
        }

        // Verificar se email já existe
        const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
        if (existing) {
            return res.status(409).json({ error: "Email já cadastrado" });
        }

        const userId = uuidv4();
        const tenantId = uuidv4();
        const hash = await bcrypt.hash(password, 12);

        const insertAll = db.transaction(() => {
            // 1. Criar tenant
            db.prepare(
                `
        INSERT INTO tenants (id, name, owner_id, plan, max_books, max_storage_mb)
        VALUES (?, ?, ?, 'free', 50, 50)
      `,
            ).run(tenantId, `Biblioteca de ${fullName}`, userId);

            // 2. Criar usuário
            db.prepare(
                `
        INSERT INTO users (id, email, password, full_name, tenant_id)
        VALUES (?, ?, ?, ?, ?)
      `,
            ).run(userId, email, hash, fullName, tenantId);

            // 3. Criar UserProgress
            db.prepare(
                `
        INSERT INTO user_progresses (tenant_id, user_id, user_name)
        VALUES (?, ?, ?)
      `,
            ).run(tenantId, userId, fullName || "Leitor");
        });

        insertAll();

        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(tenantId);
        const token = generateToken(user, tenant);

        return res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                tenantId: tenant.id,
                tenantName: tenant.name,
                plan: tenant.plan,
                isMasterAdmin: !!user.is_master_admin,
            },
        });
    } catch (err) {
        console.error("Erro no registro:", err);
        return res.status(500).json({ error: "Erro ao criar conta" });
    }
}

// POST /api/auth/login
async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email e senha são obrigatórios" });
        }

        const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
        if (!user) {
            return res.status(401).json({ error: "Credenciais inválidas" });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: "Conta desativada. Contate o suporte." });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: "Credenciais inválidas" });
        }

        const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(user.tenant_id);

        // Atualizar último login
        db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);

        const token = generateToken(user, tenant);

        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                avatarPath: user.avatar_path,
                tenantId: tenant.id,
                tenantName: tenant.name,
                plan: tenant.plan,
                isMasterAdmin: !!user.is_master_admin,
            },
        });
    } catch (err) {
        console.error("Erro no login:", err);
        return res.status(500).json({ error: "Erro ao fazer login" });
    }
}

// GET /api/auth/me
function getMe(req, res) {
    try {
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
        const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(req.user.tenantId);

        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

        const booksUsed = db.prepare("SELECT COUNT(*) as c FROM books WHERE tenant_id = ?").get(tenant.id)?.c || 0;

        return res.json({
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            avatarPath: user.avatar_path,
            tenantId: tenant.id,
            tenantName: tenant.name,
            plan: tenant.plan,
            maxBooks: tenant.max_books,
            booksUsed,
            isMasterAdmin: !!user.is_master_admin,
            isOwner: tenant.owner_id === user.id,
            createdAt: user.created_at,
        });
    } catch (err) {
        console.error("Erro ao buscar usuário:", err);
        return res.status(500).json({ error: "Erro ao buscar dados do usuário" });
    }
}

// PUT /api/auth/profile
async function updateProfile(req, res) {
    try {
        const { fullName } = req.body;
        const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : undefined;

        if (fullName) {
            db.prepare("UPDATE users SET full_name = ? WHERE id = ?").run(fullName, req.user.id);
            db.prepare("UPDATE user_progresses SET user_name = ? WHERE user_id = ?").run(fullName, req.user.id);
        }

        if (avatarPath) {
            db.prepare("UPDATE users SET avatar_path = ? WHERE id = ?").run(avatarPath, req.user.id);
        }

        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
        const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(req.user.tenantId);

        return res.json({
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            avatarPath: user.avatar_path,
            tenantId: tenant.id,
            tenantName: tenant.name,
            plan: tenant.plan,
        });
    } catch (err) {
        console.error("Erro ao atualizar perfil:", err);
        return res.status(500).json({ error: "Erro ao atualizar perfil" });
    }
}

// POST /api/auth/change-password
async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Senha atual e nova senha são obrigatórias" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres" });
        }

        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
        const valid = await bcrypt.compare(currentPassword, user.password);

        if (!valid) {
            return res.status(401).json({ error: "Senha atual incorreta" });
        }

        const hash = await bcrypt.hash(newPassword, 12);
        db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, req.user.id);

        return res.json({ message: "Senha alterada com sucesso" });
    } catch (err) {
        console.error("Erro ao alterar senha:", err);
        return res.status(500).json({ error: "Erro ao alterar senha" });
    }
}

module.exports = { register, login, getMe, updateProfile, changePassword };
