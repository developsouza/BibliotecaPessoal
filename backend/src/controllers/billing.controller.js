const jwt = require("jsonwebtoken");
const db = require("../config/database");
const stripe = require("../lib/stripe");
const paymentService = require("../services/payment.service");
const { SubscriptionStatus, isSubscriptionInactive } = require("../helpers/planLimits");

// ============================================================
// Helper: gerar novo token JWT com plano atualizado
// ============================================================

function generateUpdatedToken(userId, tenantId) {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(tenantId);

    if (!user || !tenant) throw new Error("Usuário ou tenant não encontrado");

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

// ============================================================
// GET /api/billing — Portal de Cobrança
// ============================================================

async function getPortal(req, res) {
    const tenantId = req.user.tenantId;
    const { checkoutSuccess } = req.query;

    try {
        let subscription;

        if (checkoutSuccess === "true") {
            await paymentService.sleep(5000);
            subscription = await paymentService.processCheckoutManually(tenantId);
            if (!subscription) {
                await paymentService.sleep(3000);
                subscription = await paymentService.syncSubscriptionStatus(tenantId);
            }
            if (!subscription) {
                await paymentService.sleep(2000);
                subscription = await paymentService.processCheckoutManually(tenantId);
            }
        } else {
            subscription = await paymentService.syncSubscriptionStatus(tenantId);
        }

        if (!subscription) {
            subscription = paymentService.getSubscription(tenantId);
        }

        const payments = paymentService.getPaymentHistory(tenantId);
        const upcomingAmount = subscription ? await paymentService.getUpcomingInvoiceAmount(tenantId) : null;

        // Quando o checkout acabou de ser concluído, emitir novo token com plano atualizado
        let newToken = null;
        if (checkoutSuccess === "true" && subscription) {
            try {
                newToken = generateUpdatedToken(req.user.id, tenantId);
            } catch {}
        }

        return res.json({ subscription, payments, upcomingAmount, newToken });
    } catch (err) {
        console.error("Erro no portal de cobrança:", err);
        return res.status(500).json({ error: "Erro ao carregar dados de cobrança." });
    }
}

// ============================================================
// POST /api/billing/upgrade — Upgrade de Plano
// ============================================================

async function upgradePlan(req, res) {
    const tenantId = req.user.tenantId;
    const { plan } = req.body;

    if (!plan || plan === "free") {
        return res.status(400).json({
            error: "Não é possível fazer downgrade direto para o plano Free. Cancele sua assinatura atual.",
        });
    }

    if (!["premium", "pro"].includes(plan)) {
        return res.status(400).json({ error: "Plano inválido. Use: premium ou pro." });
    }

    try {
        const existing = paymentService.getSubscription(tenantId);

        const needsNewSubscription = !existing || isSubscriptionInactive(existing.status);

        if (needsNewSubscription) {
            if (existing) {
                await paymentService.archiveCancelledSubscription(tenantId);
            }

            const successUrl = `${process.env.FRONTEND_URL}/billing?checkoutSuccess=true`;
            const cancelUrl = `${process.env.FRONTEND_URL}/billing/upgrade`;

            const checkoutUrl = await paymentService.createCheckoutSession(tenantId, plan, successUrl, cancelUrl);
            return res.json({ checkoutUrl });
        }

        // Assinatura ativa — atualizar diretamente com proração
        const isInTrial = existing.isTrialPeriod && existing.trialEnd && new Date(existing.trialEnd) > new Date();

        const subscription = await paymentService.updateSubscriptionPlan(tenantId, plan);

        const newToken = generateUpdatedToken(req.user.id, tenantId);

        const planLabel = plan === "premium" ? "Premium" : "Pro";

        return res.json({
            subscription,
            newToken,
            isTrialUpgrade: isInTrial,
            message: isInTrial
                ? `Plano atualizado para ${planLabel}! A cobrança começa após o trial.`
                : `Plano atualizado para ${planLabel} com sucesso! Você será cobrado pelo valor proporcional dos dias restantes.`,
        });
    } catch (err) {
        if (err.type === "StripeError" || err.type === "StripeCardError") {
            return res.status(402).json({ error: `Erro no pagamento: ${err.message}` });
        }
        console.error("Erro no upgrade:", err);
        return res.status(500).json({ error: err.message || "Erro ao processar upgrade." });
    }
}

// ============================================================
// POST /api/billing/cancel — Cancelar Assinatura
// ============================================================

async function cancelSubscription(req, res) {
    const tenantId = req.user.tenantId;
    const { immediately = false } = req.body;

    try {
        const subscription = await paymentService.cancelSubscription(tenantId, immediately);

        return res.json({
            subscription,
            message: immediately ? "Assinatura cancelada imediatamente." : "Assinatura será cancelada no fim do período atual.",
        });
    } catch (err) {
        console.error("Erro ao cancelar assinatura:", err);
        return res.status(500).json({ error: "Erro ao cancelar assinatura. Tente novamente." });
    }
}

// ============================================================
// POST /api/billing/reactivate — Reativar Assinatura
// ============================================================

async function reactivateSubscription(req, res) {
    const tenantId = req.user.tenantId;

    try {
        const subscription = await paymentService.reactivateSubscription(tenantId);

        return res.json({
            subscription,
            message: "Assinatura reativada com sucesso!",
        });
    } catch (err) {
        console.error("Erro ao reativar assinatura:", err);
        return res.status(500).json({ error: "Erro ao reativar assinatura. Tente novamente." });
    }
}

// ============================================================
// GET /api/billing/portal — Portal do Cliente Stripe
// ============================================================

async function getStripePortal(req, res) {
    const tenantId = req.user.tenantId;
    const returnUrl = `${process.env.FRONTEND_URL}/billing`;

    try {
        let tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(tenantId);

        if (!tenant.stripe_customer_id) {
            const user = db.prepare("SELECT email FROM users WHERE tenant_id = ? LIMIT 1").get(tenantId);
            await paymentService.createCustomer(tenantId, user ? user.email : "");
            tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(tenantId);
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: tenant.stripe_customer_id,
            return_url: returnUrl,
        });

        return res.json({ portalUrl: session.url });
    } catch (err) {
        console.error("Erro ao acessar portal Stripe:", err);
        return res.status(500).json({ error: "Erro ao acessar portal de gerenciamento." });
    }
}

module.exports = {
    getPortal,
    upgradePlan,
    cancelSubscription,
    reactivateSubscription,
    getStripePortal,
};
