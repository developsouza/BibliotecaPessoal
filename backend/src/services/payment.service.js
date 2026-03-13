const { v4: uuidv4 } = require("uuid");
const stripe = require("../lib/stripe");
const db = require("../config/database");
const { PLAN_FEATURES, SubscriptionStatus, PaymentStatus, mapStripeStatus, getStripePriceId } = require("../helpers/planLimits");

// ============================================================
// Helpers internos
// ============================================================

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Converte um timestamp Unix (segundos) do Stripe para ISO string.
 * Retorna null se o valor for nulo, undefined, 0 ou inválido.
 */
function safeDate(unixTs) {
    if (!unixTs || typeof unixTs !== "number") return null;
    const d = new Date(unixTs * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatSubscription(row) {
    if (!row) return null;
    return {
        id: row.id,
        tenantId: row.tenant_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        stripeCustomerId: row.stripe_customer_id,
        plan: row.plan,
        status: row.status,
        currentPeriodStart: row.current_period_start,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: !!row.cancel_at_period_end,
        trialEnd: row.trial_end,
        isTrialPeriod: row.is_trial_period ? !!row.is_trial_period : row.status === "trial",
        cancelledAt: row.cancelled_at,
        endedAt: row.ended_at || null,
        monthlyAmount: row.monthly_amount,
        currency: row.currency,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function formatPayment(row) {
    if (!row) return null;
    return {
        id: row.id,
        tenantId: row.tenant_id,
        stripePaymentIntentId: row.stripe_payment_intent_id,
        stripeInvoiceId: row.stripe_invoice_id,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        description: row.description,
        paidAt: row.paid_at,
        failedAt: row.failed_at,
        failureMessage: row.failure_message,
        invoiceUrl: row.invoice_url,
        invoicePdfUrl: row.invoice_pdf_url,
        createdAt: row.created_at,
    };
}

// ============================================================
// 7.1 Criar Cliente Stripe
// ============================================================

async function createCustomer(tenantId, email) {
    const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(tenantId);
    if (!tenant) throw new Error("Tenant não encontrado");

    const customer = await stripe.customers.create({
        email,
        name: tenant.name,
        description: `Biblioteca Pessoal: ${tenant.name}`,
        metadata: {
            tenant_id: tenantId,
            owner_email: email,
        },
    });

    db.prepare("UPDATE tenants SET stripe_customer_id = ? WHERE id = ?").run(customer.id, tenantId);

    return customer.id;
}

// ============================================================
// 7.2 Criar Checkout Session
// ============================================================

async function createCheckoutSession(tenantId, plan, successUrl, cancelUrl) {
    const tenant = db
        .prepare("SELECT *, (SELECT email FROM users WHERE id = tenants.owner_id) as owner_email FROM tenants WHERE id = ?")
        .get(tenantId);
    if (!tenant) throw new Error("Tenant não encontrado");

    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
        const user = db.prepare("SELECT email FROM users WHERE tenant_id = ? LIMIT 1").get(tenantId);
        const email = user ? user.email : "";
        customerId = await createCustomer(tenantId, email);
    }

    const priceId = getStripePriceId(plan);
    const planFeatures = PLAN_FEATURES[plan];

    const sessionParams = {
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
            metadata: {
                tenant_id: tenantId,
                plan: plan,
            },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: tenantId,
    };

    if (planFeatures.trialDays > 0) {
        sessionParams.subscription_data.trial_period_days = planFeatures.trialDays;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return session.url;
}

// ============================================================
// 7.4 Atualizar Plano (Proração)
// ============================================================

async function updateSubscriptionPlan(tenantId, newPlan) {
    const row = db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(tenantId);
    if (!row) throw new Error("Assinatura não encontrada");

    const newPriceId = getStripePriceId(newPlan);

    const stripeSub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);

    await stripe.subscriptions.update(row.stripe_subscription_id, {
        items: [
            {
                id: stripeSub.items.data[0].id,
                price: newPriceId,
            },
        ],
        proration_behavior: "create_prorations",
    });

    const planFeatures = PLAN_FEATURES[newPlan];

    db.prepare(`UPDATE subscriptions SET plan = ?, monthly_amount = ?, updated_at = datetime('now') WHERE tenant_id = ?`).run(
        newPlan,
        planFeatures.monthlyPrice,
        tenantId,
    );

    db.prepare(`UPDATE tenants SET plan = ?, max_books = ?, max_storage_mb = ? WHERE id = ?`).run(
        newPlan,
        planFeatures.maxBooks,
        planFeatures.maxStorageMB,
        tenantId,
    );

    return formatSubscription(db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(tenantId));
}

// ============================================================
// 7.5 Cancelar Assinatura
// ============================================================

async function cancelSubscription(tenantId, immediately = false) {
    const row = db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(tenantId);
    if (!row) throw new Error("Assinatura não encontrada");

    if (immediately) {
        await stripe.subscriptions.cancel(row.stripe_subscription_id);
        db.prepare(
            `UPDATE subscriptions SET status = ?, ended_at = datetime('now'), cancelled_at = datetime('now'), updated_at = datetime('now') WHERE tenant_id = ?`,
        ).run(SubscriptionStatus.Cancelled, tenantId);
    } else {
        await stripe.subscriptions.update(row.stripe_subscription_id, {
            cancel_at_period_end: true,
        });
        db.prepare(
            `UPDATE subscriptions SET cancel_at_period_end = 1, cancelled_at = datetime('now'), updated_at = datetime('now') WHERE tenant_id = ?`,
        ).run(tenantId);
    }

    return formatSubscription(db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(tenantId));
}

// ============================================================
// 7.6 Reativar Assinatura
// ============================================================

async function reactivateSubscription(tenantId) {
    const row = db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(tenantId);
    if (!row) throw new Error("Assinatura não encontrada");

    await stripe.subscriptions.update(row.stripe_subscription_id, {
        cancel_at_period_end: false,
    });

    db.prepare(
        `UPDATE subscriptions SET cancel_at_period_end = 0, cancelled_at = NULL, status = ?, updated_at = datetime('now') WHERE tenant_id = ?`,
    ).run(SubscriptionStatus.Active, tenantId);

    return formatSubscription(db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(tenantId));
}

// ============================================================
// 7.7 Sincronizar Status com Stripe
// ============================================================

async function syncSubscriptionStatus(tenantId) {
    const row = db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(tenantId);
    if (!row) return null;

    try {
        const stripeSub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);

        db.prepare(
            `UPDATE subscriptions
             SET status = ?, current_period_start = ?, current_period_end = ?, cancel_at_period_end = ?, updated_at = datetime('now')
             WHERE tenant_id = ?`,
        ).run(
            mapStripeStatus(stripeSub.status),
            safeDate(stripeSub.current_period_start),
            safeDate(stripeSub.current_period_end),
            stripeSub.cancel_at_period_end ? 1 : 0,
            tenantId,
        );

        // Corrigir inconsistência plano tenant vs subscription
        const tenant = db.prepare("SELECT plan FROM tenants WHERE id = ?").get(tenantId);
        if (tenant && tenant.plan !== row.plan) {
            const planFeatures = PLAN_FEATURES[row.plan];
            if (planFeatures) {
                db.prepare("UPDATE tenants SET plan = ?, max_books = ?, max_storage_mb = ? WHERE id = ?").run(
                    row.plan,
                    planFeatures.maxBooks,
                    planFeatures.maxStorageMB,
                    tenantId,
                );
            }
        }

        return formatSubscription(db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(tenantId));
    } catch (err) {
        console.error("Erro ao sincronizar com Stripe:", err.message);
        return formatSubscription(row);
    }
}

// ============================================================
// 7.8 Próxima Fatura
// ============================================================

async function getUpcomingInvoiceAmount(tenantId) {
    try {
        const row = db.prepare("SELECT stripe_customer_id FROM subscriptions WHERE tenant_id = ?").get(tenantId);
        if (!row) return null;

        const invoice = await stripe.invoices.retrieveUpcoming({
            customer: row.stripe_customer_id,
        });

        return invoice.amount_due / 100;
    } catch {
        return null;
    }
}

// ============================================================
// Obter subscription atual (sem sync Stripe)
// ============================================================

function getSubscription(tenantId) {
    const row = db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(tenantId);
    return formatSubscription(row);
}

// ============================================================
// Histórico de pagamentos
// ============================================================

function getPaymentHistory(tenantId) {
    const rows = db.prepare("SELECT * FROM payments WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50").all(tenantId);
    return rows.map(formatPayment);
}

// ============================================================
// Arquivar assinatura cancelada (limpar antes de novo checkout)
// ============================================================

async function archiveCancelledSubscription(tenantId) {
    // Apenas marca no banco como archived (status mantém cancelled)
    // A nova subscription vai sobrescrever quando o webhook chegar
    db.prepare("UPDATE subscriptions SET updated_at = datetime('now') WHERE tenant_id = ?").run(tenantId);
}

// ============================================================
// Processar checkout manualmente (fallback quando webhook demora)
// ============================================================

async function processCheckoutManually(tenantId) {
    try {
        const tenant = db.prepare("SELECT stripe_customer_id FROM tenants WHERE id = ?").get(tenantId);
        if (!tenant || !tenant.stripe_customer_id) return null;

        // Buscar subscriptions ativas do customer no Stripe
        const stripeSubs = await stripe.subscriptions.list({
            customer: tenant.stripe_customer_id,
            limit: 1,
            status: "all",
        });

        if (!stripeSubs.data.length) return null;

        const stripeSub = stripeSubs.data[0];
        const plan = (stripeSub.metadata && stripeSub.metadata.plan) || "premium";
        const planFeatures = PLAN_FEATURES[plan] || PLAN_FEATURES.premium;

        const existing = db.prepare("SELECT id FROM subscriptions WHERE tenant_id = ?").get(tenantId);

        if (!existing) {
            db.prepare(
                `INSERT INTO subscriptions (id, tenant_id, stripe_subscription_id, stripe_customer_id, plan, status, current_period_start, current_period_end, is_trial_period, trial_end, monthly_amount, currency)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
                uuidv4(),
                tenantId,
                stripeSub.id,
                stripeSub.customer,
                plan,
                mapStripeStatus(stripeSub.status),
                safeDate(stripeSub.current_period_start),
                safeDate(stripeSub.current_period_end),
                stripeSub.status === "trialing" ? 1 : 0,
                safeDate(stripeSub.trial_end),
                planFeatures.monthlyPrice,
                "BRL",
            );
        } else {
            db.prepare(
                `UPDATE subscriptions SET stripe_subscription_id = ?, stripe_customer_id = ?, plan = ?, status = ?,
                 current_period_start = ?, current_period_end = ?, is_trial_period = ?, trial_end = ?, updated_at = datetime('now')
                 WHERE tenant_id = ?`,
            ).run(
                stripeSub.id,
                stripeSub.customer,
                plan,
                mapStripeStatus(stripeSub.status),
                safeDate(stripeSub.current_period_start),
                safeDate(stripeSub.current_period_end),
                stripeSub.status === "trialing" ? 1 : 0,
                safeDate(stripeSub.trial_end),
                tenantId,
            );
        }

        db.prepare("UPDATE tenants SET plan = ?, max_books = ?, max_storage_mb = ?, stripe_customer_id = ? WHERE id = ?").run(
            plan,
            planFeatures.maxBooks,
            planFeatures.maxStorageMB,
            stripeSub.customer,
            tenantId,
        );

        return formatSubscription(db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(tenantId));
    } catch (err) {
        console.error("Erro no processCheckoutManually:", err.message);
        return null;
    }
}

module.exports = {
    createCustomer,
    createCheckoutSession,
    updateSubscriptionPlan,
    cancelSubscription,
    reactivateSubscription,
    syncSubscriptionStatus,
    getUpcomingInvoiceAmount,
    getSubscription,
    getPaymentHistory,
    archiveCancelledSubscription,
    processCheckoutManually,
    sleep,
};
