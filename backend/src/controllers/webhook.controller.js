const { v4: uuidv4 } = require("uuid");
const stripe = require("../lib/stripe");
const db = require("../config/database");
const { PLAN_FEATURES, SubscriptionStatus, PaymentStatus, mapStripeStatus } = require("../helpers/planLimits");

/** Converte timestamp Unix (segundos) do Stripe em ISO string de forma segura. */
function safeDate(unixTs) {
    if (!unixTs || typeof unixTs !== "number") return null;
    const d = new Date(unixTs * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

// ============================================================
// 9.1 checkout.session.completed
// ============================================================

async function handleCheckoutCompleted(session) {
    if (session.mode !== "subscription") return;

    const tenantId = session.client_reference_id || session.metadata?.tenant_id;
    if (!tenantId || !session.subscription) return;

    const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
    const plan = (stripeSub.metadata && stripeSub.metadata.plan) || "premium";
    const planFeatures = PLAN_FEATURES[plan] || PLAN_FEATURES.premium;

    const existing = db.prepare("SELECT id FROM subscriptions WHERE tenant_id = ?").get(tenantId);

    if (!existing) {
        db.prepare(
            `INSERT INTO subscriptions (id, tenant_id, stripe_subscription_id, stripe_customer_id, plan, status,
             current_period_start, current_period_end, is_trial_period, trial_end, monthly_amount, currency)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
            uuidv4(),
            tenantId,
            stripeSub.id,
            typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id,
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
            `UPDATE subscriptions SET plan = ?, status = ?, current_period_start = ?, current_period_end = ?,
             stripe_subscription_id = ?, is_trial_period = ?, trial_end = ?, updated_at = datetime('now')
             WHERE tenant_id = ?`,
        ).run(
            plan,
            mapStripeStatus(stripeSub.status),
            safeDate(stripeSub.current_period_start),
            safeDate(stripeSub.current_period_end),
            stripeSub.id,
            stripeSub.status === "trialing" ? 1 : 0,
            safeDate(stripeSub.trial_end),
            tenantId,
        );
    }

    // Atualizar plano e limites do tenant
    const customerId = typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id;
    db.prepare("UPDATE tenants SET plan = ?, max_books = ?, max_storage_mb = ?, stripe_customer_id = ? WHERE id = ?").run(
        plan,
        planFeatures.maxBooks,
        planFeatures.maxStorageMB,
        customerId,
        tenantId,
    );

    console.log(`✅ Checkout concluído: tenant=${tenantId} plano=${plan}`);
}

// ============================================================
// 9.2 customer.subscription.updated / created
// ============================================================

async function handleSubscriptionUpdated(stripeSub) {
    const tenantId = stripeSub.metadata && stripeSub.metadata.tenant_id;
    if (!tenantId) return;

    const row = db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(tenantId);
    if (!row) return;

    db.prepare(
        `UPDATE subscriptions SET status = ?, current_period_start = ?, current_period_end = ?,
         cancel_at_period_end = ?, updated_at = datetime('now') WHERE tenant_id = ?`,
    ).run(
        mapStripeStatus(stripeSub.status),
        safeDate(stripeSub.current_period_start),
        safeDate(stripeSub.current_period_end),
        stripeSub.cancel_at_period_end ? 1 : 0,
        tenantId,
    );

    // Corrigir inconsistência de plano
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

    console.log(`🔄 Subscription atualizada: tenant=${tenantId} status=${stripeSub.status}`);
}

// ============================================================
// 9.3 customer.subscription.deleted
// ============================================================

async function handleSubscriptionDeleted(stripeSub) {
    const tenantId = stripeSub.metadata && stripeSub.metadata.tenant_id;
    if (!tenantId) return;

    const row = db.prepare("SELECT id FROM subscriptions WHERE tenant_id = ?").get(tenantId);
    if (row) {
        db.prepare(`UPDATE subscriptions SET status = ?, ended_at = datetime('now'), updated_at = datetime('now') WHERE tenant_id = ?`).run(
            SubscriptionStatus.Cancelled,
            tenantId,
        );
    }

    // Reverter tenant para Free
    const freeLimits = PLAN_FEATURES.free;
    db.prepare("UPDATE tenants SET plan = ?, max_books = ?, max_storage_mb = ? WHERE id = ?").run(
        "free",
        freeLimits.maxBooks,
        freeLimits.maxStorageMB,
        tenantId,
    );

    console.log(`❌ Subscription cancelada: tenant=${tenantId} → revertido para Free`);
}

// ============================================================
// 9.4 invoice.payment_succeeded
// ============================================================

async function handlePaymentSucceeded(invoice) {
    if (!invoice.subscription) return;

    const stripeSub = await stripe.subscriptions.retrieve(typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id);

    const tenantId = stripeSub.metadata && stripeSub.metadata.tenant_id;
    if (!tenantId) return;

    // Evitar duplicatas
    const existingPayment = invoice.payment_intent
        ? db.prepare("SELECT id FROM payments WHERE stripe_payment_intent_id = ?").get(invoice.payment_intent)
        : null;

    if (existingPayment) return;

    const subscriptionRow = db.prepare("SELECT id FROM subscriptions WHERE tenant_id = ?").get(tenantId);

    db.prepare(
        `INSERT INTO payments (id, tenant_id, subscription_id, stripe_payment_intent_id, stripe_invoice_id,
         amount, currency, status, description, paid_at, invoice_url, invoice_pdf_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
    ).run(
        uuidv4(),
        tenantId,
        subscriptionRow ? subscriptionRow.id : null,
        invoice.payment_intent || invoice.id,
        invoice.id,
        invoice.amount_paid / 100,
        (invoice.currency || "brl").toUpperCase(),
        PaymentStatus.Succeeded,
        invoice.description || "Assinatura BookLibrary",
        invoice.hosted_invoice_url || null,
        invoice.invoice_pdf || null,
    );

    console.log(`💰 Pagamento registrado: tenant=${tenantId} valor=${invoice.amount_paid / 100}`);
}

// ============================================================
// 9.5 invoice.payment_failed
// ============================================================

async function handlePaymentFailed(invoice) {
    if (!invoice.subscription) return;

    const stripeSub = await stripe.subscriptions.retrieve(typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id);

    const tenantId = stripeSub.metadata && stripeSub.metadata.tenant_id;
    if (!tenantId) return;

    const subscriptionRow = db.prepare("SELECT id FROM subscriptions WHERE tenant_id = ?").get(tenantId);

    db.prepare(
        `INSERT INTO payments (id, tenant_id, subscription_id, stripe_payment_intent_id, stripe_invoice_id,
         amount, currency, status, description, failed_at, failure_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
    ).run(
        uuidv4(),
        tenantId,
        subscriptionRow ? subscriptionRow.id : null,
        invoice.payment_intent || invoice.id,
        invoice.id,
        invoice.amount_due / 100,
        (invoice.currency || "brl").toUpperCase(),
        PaymentStatus.Failed,
        invoice.description || "Assinatura BookLibrary",
        "Pagamento falhou",
    );

    // Atualizar status da assinatura para past_due se necessário
    db.prepare(`UPDATE subscriptions SET status = ?, updated_at = datetime('now') WHERE tenant_id = ? AND status = ?`).run(
        SubscriptionStatus.PastDue,
        tenantId,
        SubscriptionStatus.Active,
    );

    console.error(`⚠️  Pagamento falhou: tenant=${tenantId}`);
}

// ============================================================
// Handler principal do webhook
// ============================================================

async function handle(req, res) {
    if (!stripe) {
        return res.status(500).json({ error: "Stripe não configurado" });
    }

    const sig = req.headers["stripe-signature"];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook signature inválida: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case "checkout.session.completed":
                await handleCheckoutCompleted(event.data.object);
                break;
            case "customer.subscription.created":
            case "customer.subscription.updated":
                await handleSubscriptionUpdated(event.data.object);
                break;
            case "customer.subscription.deleted":
                await handleSubscriptionDeleted(event.data.object);
                break;
            case "invoice.payment_succeeded":
                await handlePaymentSucceeded(event.data.object);
                break;
            case "invoice.payment_failed":
                await handlePaymentFailed(event.data.object);
                break;
            default:
                // Evento não tratado — ignorar silenciosamente
                break;
        }

        return res.json({ received: true });
    } catch (err) {
        console.error("Erro ao processar webhook:", err);
        return res.status(500).json({ error: err.message });
    }
}

module.exports = { handle };
