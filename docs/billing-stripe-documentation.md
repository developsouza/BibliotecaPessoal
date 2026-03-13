# Documentação de Billing & Stripe — BookLibrary

> Documentação técnica completa para replicar o sistema de cobrança e assinaturas em **Node.js + Express** com **Stripe** e **React** no frontend.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Planos e Preços](#2-planos-e-preços)
3. [Modelos de Dados](#3-modelos-de-dados)
4. [Enums](#4-enums)
5. [Configuração do Stripe](#5-configuração-do-stripe)
6. [Endpoints da API (Express)](#6-endpoints-da-api-express)
   - [Portal de Cobrança](#61-portal-de-cobrança)
   - [Upgrade de Plano](#62-upgrade-de-plano)
   - [Cancelar Assinatura](#63-cancelar-assinatura)
   - [Reativar Assinatura](#64-reativar-assinatura)
   - [Portal do Cliente Stripe](#65-portal-do-cliente-stripe)
   - [Webhook do Stripe](#66-webhook-do-stripe)
7. [Serviço de Pagamento (PaymentService)](#7-serviço-de-pagamento-paymentservice)
   - [Criar Cliente Stripe](#71-criar-cliente-stripe)
   - [Criar Checkout Session](#72-criar-checkout-session)
   - [Criar Assinatura Diretamente](#73-criar-assinatura-diretamente)
   - [Atualizar Plano (Proração)](#74-atualizar-plano-proração)
   - [Cancelar Assinatura](#75-cancelar-assinatura)
   - [Reativar Assinatura](#76-reativar-assinatura)
   - [Sincronizar Status com Stripe](#77-sincronizar-status-com-stripe)
   - [Próxima Fatura](#78-próxima-fatura)
8. [Fluxo de Upgrade (Diagrama)](#8-fluxo-de-upgrade-diagrama)
9. [Webhooks do Stripe](#9-webhooks-do-stripe)
   - [checkout.session.completed](#91-checkoutsessioncompleted)
   - [customer.subscription.updated](#92-customersubscriptionupdated)
   - [customer.subscription.deleted](#93-customersubscriptiondeleted)
   - [invoice.payment_succeeded](#94-invoicepaymentsucceeded)
   - [invoice.payment_failed](#95-invoicepaymentfailed)
10. [Telas React](#10-telas-react)
    - [Portal de Cobrança](#101-portal-de-cobrança)
    - [Upgrade de Plano](#102-upgrade-de-plano)
    - [Telas de Erro/Status](#103-telas-de-errostatus)
11. [Estrutura de Pastas Sugerida](#11-estrutura-de-pastas-sugerida)
12. [Mapeamento de Status do Stripe](#12-mapeamento-de-status-do-stripe)
13. [Quirks e Pontos Críticos](#13-quirks-e-pontos-críticos)

---

## 1. Visão Geral

O sistema de billing usa **Stripe** para gerenciar assinaturas recorrentes no modelo B2C (1 usuário → 1 biblioteca pessoal). Cada usuário pode ter **uma** assinatura ativa vinculada ao seu tenant.

**Principais funcionalidades:**
- Upgrade de plano via **Stripe Checkout Session** (para novos assinantes)
- Upgrade de plano direto via **Subscription Update** com **proração** (para assinantes existentes)
- Cancelamento imediato ou no fim do período
- Reativação de assinatura cancelada
- Redirecionamento para **Stripe Customer Portal** (gerenciar cartão, faturas)
- Webhook para sincronizar eventos do Stripe com o banco de dados
- Fallback manual de checkout (quando webhook falha)

**Fluxo resumido:**

```
Usuário → Clica em Upgrade
        → Tem assinatura ativa? → SIM → UpdateSubscriptionPlan (proração)
        →                      → NÃO → CreateCheckoutSession → Stripe Hosted Page
                                               → Sucesso → ?checkoutSuccess=true
                                               → Webhook: checkout.session.completed
```

---

## 2. Planos e Preços

| Plano | Preço/mês | Trial | Livros | Storage | Price ID (Stripe) |
|---|---|---|---|---|---|
| **Free** | R$ 0,00 | — | 25 | 25 MB | — (sem assinatura) |
| **Premium** | R$ 9,90 | 7 dias | 100 | 100 MB | `Stripe:Prices:Premium` |
| **Pro** | R$ 19,90 | 14 dias | Ilimitado | 5 GB (5000 MB) | `Stripe:Prices:Pro` |
| **MasterAdmin** | — | — | — | — | Não disponível para compra |

### Features por plano

```js
const PLAN_FEATURES = {
  0: { // Free
    maxBooks: 25,
    maxStorageMB: 25,
    monthlyPrice: 0,
    trialDays: 0,
    canExportData: false,
    canUseGoogleBooksApi: false,
    canUseAdvancedStats: false,
    maxAchievementsVisible: 5,
    maxReadingHistoryVisible: 10,
    maxNotesLength: 500,
    canViewStreakHistory: false,
  },
  1: { // Premium
    maxBooks: 100,
    maxStorageMB: 100,
    monthlyPrice: 9.90,
    trialDays: 7,
    canExportData: true,
    canUseGoogleBooksApi: true,
    canUseAdvancedStats: false,
    maxAchievementsVisible: Infinity,
    maxReadingHistoryVisible: Infinity,
    maxNotesLength: 3000,
    canViewStreakHistory: true,
  },
  2: { // Pro
    maxBooks: Infinity,
    maxStorageMB: 5000,
    monthlyPrice: 19.90,
    trialDays: 14,
    canExportData: true,
    canUseGoogleBooksApi: true,
    canUseAdvancedStats: true,
    maxAchievementsVisible: Infinity,
    maxReadingHistoryVisible: Infinity,
    maxNotesLength: 3000,
    canViewStreakHistory: true,
  }
};
```

---

## 3. Modelos de Dados

### Subscription

```js
{
  id: "uuid",
  tenantId: "uuid",                   // FK → Tenant.id
  stripeSubscriptionId: "string",     // ex: "sub_xxxxx"
  stripeCustomerId: "string",         // ex: "cus_xxxxx"
  plan: 0 | 1 | 2,                   // enum TenantPlan
  status: 0 | 1 | 2 | 3 | 4 | 5 | 6, // enum SubscriptionStatus
  currentPeriodStart: "datetime",
  currentPeriodEnd: "datetime",
  cancelledAt: "datetime|null",
  endedAt: "datetime|null",
  isTrialPeriod: "boolean",
  trialEnd: "datetime|null",
  monthlyAmount: "decimal",           // ex: 9.90
  currency: "string",                 // padrão: "BRL"
  cancelAtPeriodEnd: "boolean",       // true = cancelamento agendado
  createdAt: "datetime",
  updatedAt: "datetime",

  // relacionamentos
  tenant: Tenant,
  payments: Payment[]
}
```

### Payment

```js
{
  id: "uuid",
  tenantId: "uuid",
  subscriptionId: "uuid|null",
  stripePaymentIntentId: "string",    // ex: "pi_xxxxx"
  stripeInvoiceId: "string|null",     // ex: "in_xxxxx"
  amount: "decimal",                   // valor em reais (ex: 9.90)
  currency: "string",                  // ex: "BRL"
  status: 0 | 1 | 2 | 3 | 4 | 5,    // enum PaymentStatus
  paymentMethod: "number",             // enum PaymentMethod
  last4: "string|null",               // últimos 4 dígitos do cartão
  cardBrand: "string|null",           // ex: "visa", "mastercard"
  description: "string|null",
  paidAt: "datetime|null",
  failedAt: "datetime|null",
  failureMessage: "string|null",
  invoiceUrl: "string|null",          // link para a fatura no Stripe
  invoicePdfUrl: "string|null",       // link para PDF da fatura
  createdAt: "datetime",
  updatedAt: "datetime"
}
```

### BillingAddress

```js
{
  id: "uuid",
  tenantId: "uuid",
  taxId: "string",                    // CPF ou CNPJ (máx 18 chars)
  companyName: "string",              // Nome ou Razão Social
  addressLine1: "string",
  addressLine2: "string|null",        // Complemento
  city: "string",
  state: "string",                    // UF (2 chars, ex: "SP")
  postalCode: "string",               // CEP
  country: "string",                  // padrão: "BR"
  createdAt: "datetime",
  updatedAt: "datetime"
}
```

---

## 4. Enums

### SubscriptionStatus

```js
const SubscriptionStatus = {
  Trial: 0,
  Active: 1,
  Suspended: 2,
  Cancelled: 3,
  Expired: 4,
  PastDue: 5,
  Incomplete: 6
};

const SubscriptionStatusLabel = {
  0: 'Trial',
  1: 'Ativa',
  2: 'Suspensa',
  3: 'Cancelada',
  4: 'Expirada',
  5: 'Aguardando Pagamento',
  6: 'Incompleta'
};
```

### PaymentStatus

```js
const PaymentStatus = {
  Pending: 0,
  Processing: 1,
  Succeeded: 2,
  Failed: 3,
  Cancelled: 4,
  Refunded: 5
};

const PaymentStatusLabel = {
  0: 'Pendente',
  1: 'Processando',
  2: 'Pago',
  3: 'Falhou',
  4: 'Cancelado',
  5: 'Reembolsado'
};
```

### Mapeamento Stripe Status → SubscriptionStatus

```js
const mapStripeStatus = (stripeStatus) => {
  const map = {
    'trialing':   SubscriptionStatus.Trial,
    'active':     SubscriptionStatus.Active,
    'past_due':   SubscriptionStatus.PastDue,
    'canceled':   SubscriptionStatus.Cancelled,
    'unpaid':     SubscriptionStatus.Suspended,
    'incomplete': SubscriptionStatus.Incomplete,
  };
  return map[stripeStatus] ?? SubscriptionStatus.Active;
};
```

---

## 5. Configuração do Stripe

### Variáveis de ambiente (`.env`)

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_PREMIUM=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_PRO=price_xxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **Importante:** Use **Price IDs** (`price_xxx`) e NÃO Product IDs (`prod_xxx`).
> Para obter o Price ID: Dashboard Stripe → Products → selecione o produto → copie o Price ID da seção "Pricing".

### Instalação do pacote Stripe

```bash
npm install stripe
```

### Inicialização

```js
// lib/stripe.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
module.exports = stripe;
```

### Obter Price ID por plano

```js
const getStripePriceId = (plan) => {
  switch (plan) {
    case 1: return process.env.STRIPE_PRICE_PREMIUM;
    case 2: return process.env.STRIPE_PRICE_PRO;
    default: throw new Error('Plano inválido para pagamento');
  }
};
```

---

## 6. Endpoints da API (Express)

> **Base URL:** `/api/billing`
> Todos os endpoints exigem autenticação **JWT** (exceto o webhook).

---

### 6.1 Portal de Cobrança

**`GET /api/billing`**

Retorna a assinatura atual e o histórico de pagamentos do tenant. Também aceita `?checkoutSuccess=true` para processar o checkout recém-finalizado.

**Query params:**

| Param | Tipo | Descrição |
|---|---|---|
| `checkoutSuccess` | boolean | Se `true`, sincroniza a assinatura após checkout |

**Lógica quando `checkoutSuccess=true`:**

```
1. Aguardar 5s (dar tempo ao webhook do Stripe)
2. Tentar ProcessCheckoutManually (busca subscription no Stripe)
3. Se falhar → aguardar 3s → SyncSubscriptionStatus
4. Se ainda falhar → aguardar 2s → tentar ProcessCheckoutManually novamente
5. Retornar subscription atualizada
```

**Resposta `200 OK`:**

```json
{
  "subscription": {
    "id": "uuid",
    "plan": 1,
    "status": 1,
    "monthlyAmount": 9.90,
    "currency": "BRL",
    "currentPeriodStart": "2025-06-01T00:00:00Z",
    "currentPeriodEnd": "2025-07-01T00:00:00Z",
    "isTrialPeriod": false,
    "trialEnd": null,
    "cancelAtPeriodEnd": false,
    "stripeSubscriptionId": "sub_xxxxx",
    "stripeCustomerId": "cus_xxxxx"
  },
  "payments": [
    {
      "id": "uuid",
      "amount": 9.90,
      "currency": "BRL",
      "status": 2,
      "paidAt": "2025-06-01T00:00:00Z",
      "description": "Subscription update",
      "invoiceUrl": "https://invoice.stripe.com/...",
      "invoicePdfUrl": "https://pay.stripe.com/..."
    }
  ],
  "upcomingAmount": 9.90
}
```

**Implementação Express:**

```js
router.get('/', requireAuth, async (req, res) => {
  const tenantId = req.user.tenantId;
  const { checkoutSuccess } = req.query;

  let subscription;

  if (checkoutSuccess === 'true') {
    await sleep(5000);
    subscription = await paymentService.processCheckoutManually(tenantId);
    if (!subscription) {
      await sleep(3000);
      subscription = await paymentService.syncSubscriptionStatus(tenantId);
    }
    if (!subscription) {
      await sleep(2000);
      subscription = await paymentService.processCheckoutManually(tenantId);
    }
  } else {
    subscription = await paymentService.syncSubscriptionStatus(tenantId);
  }

  const payments = await paymentService.getPaymentHistory(tenantId);
  const upcomingAmount = await paymentService.getUpcomingInvoiceAmount(tenantId);

  res.json({ subscription, payments, upcomingAmount });
});
```

---

### 6.2 Upgrade de Plano

**`POST /api/billing/upgrade`**

**Body:**

```json
{ "plan": 1 }
```

**Valores válidos de `plan`:** `1` (Premium) ou `2` (Pro). **Não aceita `0` (Free)** — para fazer downgrade para Free é necessário cancelar a assinatura.

**Lógica de decisão:**

```
1. Verificar se tem assinatura ativa
   - SEM assinatura (ou cancelled/expired/incomplete):
     → Arquivar assinatura antiga (se existir)
     → Criar Checkout Session no Stripe
     → Retornar URL de checkout
   - COM assinatura ativa (ou em trial):
     → Atualizar subscription diretamente no Stripe (com proração)
     → Atualizar plano e limites do tenant no banco
     → Renovar claims JWT do usuário
     → Retornar subscription atualizada
```

**Resposta quando precisa de checkout (novo assinante):**

```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_xxxxx"
}
```

**Resposta quando atualiza diretamente (já assinante):**

```json
{
  "subscription": { ... },
  "message": "Plano atualizado para Premium com sucesso! Você será cobrado pelo valor proporcional dos dias restantes.",
  "isTrialUpgrade": false
}
```

**Resposta `400 Bad Request`:**

```json
{ "error": "Não é possível fazer downgrade direto para o plano Free. Cancele sua assinatura atual." }
```

**Implementação Express:**

```js
router.post('/upgrade', requireAuth, async (req, res) => {
  const tenantId = req.user.tenantId;
  const { plan } = req.body;

  if (plan === 0) {
    return res.status(400).json({
      error: 'Não é possível fazer downgrade direto para o plano Free. Cancele sua assinatura atual.'
    });
  }

  try {
    const existing = await paymentService.getSubscription(tenantId);

    const needsNewSubscription = !existing ||
      [SubscriptionStatus.Cancelled, SubscriptionStatus.Expired, SubscriptionStatus.Incomplete]
        .includes(existing.status);

    if (needsNewSubscription) {
      if (existing) {
        await paymentService.archiveCancelledSubscription(tenantId);
      }

      const checkoutUrl = await paymentService.createCheckoutSession(
        tenantId, plan,
        `${process.env.FRONTEND_URL}/billing?checkoutSuccess=true`,
        `${process.env.FRONTEND_URL}/billing/upgrade`
      );

      return res.json({ checkoutUrl });
    }

    const isInTrial = existing.isTrialPeriod &&
                      existing.trialEnd &&
                      new Date(existing.trialEnd) > new Date();

    const subscription = await paymentService.updateSubscriptionPlan(tenantId, plan);

    // CRÍTICO: Atualizar token JWT com novo plano
    const newToken = await generateUpdatedToken(req.user.id, tenantId);

    res.json({
      subscription,
      newToken,
      isTrialUpgrade: isInTrial,
      message: isInTrial
        ? `Plano atualizado para ${plan}! A cobrança começa após o trial.`
        : `Plano atualizado! Você será cobrado pelo valor proporcional.`
    });
  } catch (err) {
    if (err.type === 'StripeError') {
      return res.status(402).json({ error: `Erro no pagamento: ${err.message}` });
    }
    res.status(500).json({ error: err.message });
  }
});
```

---

### 6.3 Cancelar Assinatura

**`POST /api/billing/cancel`**

**Body:**

```json
{ "immediately": false }
```

| Campo | Tipo | Descrição |
|---|---|---|
| `immediately` | boolean | `false` = cancela no fim do período · `true` = cancela agora |

**Resposta `200 OK`:**

```json
{
  "subscription": { ... },
  "message": "Assinatura será cancelada no fim do período atual."
}
```

**Implementação Express:**

```js
router.post('/cancel', requireAuth, async (req, res) => {
  const tenantId = req.user.tenantId;
  const { immediately = false } = req.body;

  try {
    const subscription = await paymentService.cancelSubscription(tenantId, immediately);

    res.json({
      subscription,
      message: immediately
        ? 'Assinatura cancelada imediatamente.'
        : 'Assinatura será cancelada no fim do período atual.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cancelar assinatura. Tente novamente.' });
  }
});
```

---

### 6.4 Reativar Assinatura

**`POST /api/billing/reactivate`**

Cancela o cancelamento agendado (`cancelAtPeriodEnd = false`). Só funciona se a assinatura **ainda não foi cancelada definitivamente**.

**Resposta `200 OK`:**

```json
{
  "subscription": { ... },
  "message": "Assinatura reativada com sucesso!"
}
```

---

### 6.5 Portal do Cliente Stripe

**`GET /api/billing/portal`**

Cria uma sessão no **Stripe Customer Portal** e retorna a URL de redirecionamento. O portal permite ao usuário:
- Gerenciar métodos de pagamento
- Visualizar faturas
- Cancelar assinatura pelo Stripe diretamente

**Resposta `200 OK`:**

```json
{ "portalUrl": "https://billing.stripe.com/session/..." }
```

**Implementação Express:**

```js
router.get('/portal', requireAuth, async (req, res) => {
  const tenantId = req.user.tenantId;
  const returnUrl = `${process.env.FRONTEND_URL}/billing`;

  try {
    const tenant = await Tenant.findByPk(tenantId, { include: ['owner'] });

    if (!tenant.stripeCustomerId) {
      await paymentService.createCustomer(tenant, tenant.owner.email);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: returnUrl,
    });

    res.json({ portalUrl: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao acessar portal de gerenciamento.' });
  }
});
```

---

### 6.6 Webhook do Stripe

**`POST /webhook/stripe`**

> ⚠️ Rota **pública** — sem autenticação JWT.
> O corpo da requisição deve ser lido como **raw buffer** para validar a assinatura do Stripe.

**Header obrigatório:** `Stripe-Signature: t=...,v1=...`

**Eventos tratados:**

| Evento | Ação |
|---|---|
| `checkout.session.completed` | Criar ou atualizar subscription no banco |
| `customer.subscription.created` | Criar subscription no banco |
| `customer.subscription.updated` | Atualizar status e plano da subscription |
| `customer.subscription.deleted` | Marcar como cancelada, reverter tenant para Free |
| `invoice.payment_succeeded` | Registrar pagamento como sucesso |
| `invoice.payment_failed` | Registrar pagamento como falha |

**Configuração Express (raw body obrigatório):**

```js
// app.js — DEVE vir ANTES do express.json() para esta rota
app.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  webhookController.handle
);

// Para as outras rotas
app.use(express.json());
```

**Implementação do handler:**

```js
// controllers/webhookController.js
const stripe = require('../lib/stripe');

exports.handle = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,               // raw buffer
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook signature invalid: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: err.message });
  }
};
```

---

## 7. Serviço de Pagamento (PaymentService)

### 7.1 Criar Cliente Stripe

Cria um Customer no Stripe e salva o `stripeCustomerId` no banco.

```js
async createCustomer(tenant, email) {
  const customer = await stripe.customers.create({
    email,
    name: tenant.name,
    description: `Biblioteca Pessoal: ${tenant.name}`,
    metadata: {
      tenant_id: tenant.id,
      owner_email: email
    }
  });

  await Tenant.update(
    { stripeCustomerId: customer.id },
    { where: { id: tenant.id } }
  );

  return customer.id;
}
```

---

### 7.2 Criar Checkout Session

Usado quando o usuário não tem assinatura ativa. Redireciona para a página de pagamento hospedada pelo Stripe.

```js
async createCheckoutSession(tenantId, plan, successUrl, cancelUrl) {
  const tenant = await Tenant.findByPk(tenantId, { include: ['owner'] });

  if (!tenant.stripeCustomerId) {
    await this.createCustomer(tenant, tenant.owner.email);
    await tenant.reload();
  }

  const priceId = getStripePriceId(plan);
  const trialDays = PLAN_FEATURES[plan].trialDays;

  const session = await stripe.checkout.sessions.create({
    customer: tenant.stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: {
        tenant_id: tenantId,
        plan: String(plan)
      },
      ...(trialDays > 0 && { trial_period_days: trialDays })
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: tenantId
  });

  return session.url;
}
```

---

### 7.3 Criar Assinatura Diretamente

Usado em casos onde o cliente já existe no Stripe e você quer criar a subscription programaticamente (sem checkout page).

```js
async createSubscription(tenantId, plan, trialDays = null) {
  const tenant = await Tenant.findByPk(tenantId, { include: ['owner'] });

  if (!tenant.stripeCustomerId) {
    await this.createCustomer(tenant, tenant.owner.email);
    await tenant.reload();
  }

  const priceId = getStripePriceId(plan);
  const planFeatures = PLAN_FEATURES[plan];

  const subOptions = {
    customer: tenant.stripeCustomerId,
    items: [{ price: priceId }],
    metadata: { tenant_id: tenantId, plan: String(plan) }
  };

  if (trialDays) subOptions.trial_period_days = trialDays;

  const stripeSub = await stripe.subscriptions.create(subOptions);

  // Salvar no banco
  const subscription = await Subscription.create({
    tenantId,
    stripeSubscriptionId: stripeSub.id,
    stripeCustomerId: tenant.stripeCustomerId,
    plan,
    status: mapStripeStatus(stripeSub.status),
    currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    isTrialPeriod: stripeSub.status === 'trialing',
    trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
    monthlyAmount: planFeatures.monthlyPrice,
    currency: 'BRL'
  });

  // Atualizar limites do tenant
  await Tenant.update(
    { plan, maxBooks: planFeatures.maxBooks, maxStorageMB: planFeatures.maxStorageMB },
    { where: { id: tenantId } }
  );

  return subscription;
}
```

---

### 7.4 Atualizar Plano (Proração)

Atualiza o plano de uma assinatura existente e ativa. O Stripe calcula automaticamente a **proração** (crédito/débito pelo período restante).

```js
async updateSubscriptionPlan(tenantId, newPlan) {
  const subscription = await Subscription.findOne({ where: { tenantId } });
  if (!subscription) throw new Error('Assinatura não encontrada');

  const newPriceId = getStripePriceId(newPlan);

  // Buscar a subscription atual no Stripe para obter o item ID
  const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

  // Atualizar o item com o novo preço (proração automática)
  const updatedStripeSub = await stripe.subscriptions.update(
    subscription.stripeSubscriptionId,
    {
      items: [{
        id: stripeSub.items.data[0].id,
        price: newPriceId
      }],
      proration_behavior: 'create_prorations' // cobra/credita proporcionalmente
    }
  );

  const planFeatures = PLAN_FEATURES[newPlan];

  // Atualizar banco
  await Subscription.update(
    { plan: newPlan, monthlyAmount: planFeatures.monthlyPrice, updatedAt: new Date() },
    { where: { tenantId } }
  );

  await Tenant.update(
    { plan: newPlan, maxBooks: planFeatures.maxBooks, maxStorageMB: planFeatures.maxStorageMB },
    { where: { id: tenantId } }
  );

  return await Subscription.findOne({ where: { tenantId } });
}
```

---

### 7.5 Cancelar Assinatura

```js
async cancelSubscription(tenantId, immediately = false) {
  const subscription = await Subscription.findOne({ where: { tenantId } });
  if (!subscription) throw new Error('Assinatura não encontrada');

  if (immediately) {
    // Cancela agora mesmo
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    await subscription.update({
      status: SubscriptionStatus.Cancelled,
      endedAt: new Date(),
      cancelledAt: new Date(),
      updatedAt: new Date()
    });
  } else {
    // Cancela no fim do período
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });
    await subscription.update({
      cancelAtPeriodEnd: true,
      cancelledAt: new Date(),
      updatedAt: new Date()
    });
  }

  return subscription;
}
```

---

### 7.6 Reativar Assinatura

```js
async reactivateSubscription(tenantId) {
  const subscription = await Subscription.findOne({ where: { tenantId } });
  if (!subscription) throw new Error('Assinatura não encontrada');

  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: false
  });

  await subscription.update({
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    status: SubscriptionStatus.Active,
    updatedAt: new Date()
  });

  return subscription;
}
```

---

### 7.7 Sincronizar Status com Stripe

Busca o status atual da subscription no Stripe e atualiza o banco. Também detecta e corrige inconsistências de plano entre `Subscription` e `Tenant`.

```js
async syncSubscriptionStatus(tenantId) {
  const subscription = await Subscription.findOne({
    where: { tenantId },
    include: [{ model: Tenant, as: 'tenant' }]
  });

  if (!subscription) return null;

  const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

  await subscription.update({
    status: mapStripeStatus(stripeSub.status),
    currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    updatedAt: new Date()
  });

  // Corrigir inconsistência de plano (tenant.plan != subscription.plan)
  if (subscription.tenant && subscription.tenant.plan !== subscription.plan) {
    const planFeatures = PLAN_FEATURES[subscription.plan];
    await Tenant.update(
      { plan: subscription.plan, maxBooks: planFeatures.maxBooks, maxStorageMB: planFeatures.maxStorageMB },
      { where: { id: tenantId } }
    );
  }

  return subscription;
}
```

---

### 7.8 Próxima Fatura

```js
async getUpcomingInvoiceAmount(tenantId) {
  try {
    const subscription = await Subscription.findOne({ where: { tenantId } });
    if (!subscription) return null;

    const invoice = await stripe.invoices.retrieveUpcoming({
      customer: subscription.stripeCustomerId
    });

    return invoice.amount_due / 100; // centavos → reais
  } catch {
    return null; // Retorna null se não houver próxima fatura
  }
}
```

---

## 8. Fluxo de Upgrade (Diagrama)

```
Usuário clica "Upgrade para Premium"
        │
        ▼
POST /api/billing/upgrade { plan: 1 }
        │
        ├── Subscription existe e está Active/Trial?
        │         │
        │        SIM ─────────────────────────────────────────►
        │                                                        │
        │                                               stripe.subscriptions.update()
        │                                               (proration_behavior: 'create_prorations')
        │                                                        │
        │                                               Atualiza Subscription + Tenant no banco
        │                                                        │
        │                                               Gera novo JWT com plano atualizado
        │                                                        │
        │                                               ◄─── { subscription, newToken }
        │
        └── NÃO (sem assinatura / cancelada / expirada)
                  │
                  ▼
         Arquivar subscription antiga (se existir)
                  │
                  ▼
         stripe.checkout.sessions.create()
                  │
                  ▼
         ◄─── { checkoutUrl }
                  │
         Frontend redireciona para checkoutUrl
                  │
                  ▼
         Usuário preenche dados no Stripe
                  │
              ┌───┴───┐
           Sucesso   Cancelou
              │         │
              ▼         ▼
   /billing?checkoutSuccess=true   /billing/upgrade
              │
   GET /api/billing?checkoutSuccess=true
              │
   [espera 5s] → ProcessCheckoutManually()
              │
   [se falhar] → [espera 3s] → SyncSubscriptionStatus()
              │
   [se falhar] → [espera 2s] → ProcessCheckoutManually()
              │
   Redireciona para /billing (sem o query param)
```

---

## 9. Webhooks do Stripe

### 9.1 `checkout.session.completed`

Disparado quando o usuário conclui o checkout. Cria a subscription no banco se ainda não existir.

```js
async function handleCheckoutCompleted(session) {
  if (session.mode !== 'subscription') return;

  const tenantId = session.client_reference_id || session.metadata?.tenant_id;
  if (!session.subscription) return;

  const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
  const plan = Number(stripeSub.metadata.plan);
  const planFeatures = PLAN_FEATURES[plan];

  let subscription = await Subscription.findOne({ where: { tenantId } });

  if (!subscription) {
    subscription = await Subscription.create({
      tenantId,
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId: stripeSub.customer,
      plan,
      status: mapStripeStatus(stripeSub.status),
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      isTrialPeriod: stripeSub.status === 'trialing',
      trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
      monthlyAmount: planFeatures.monthlyPrice,
      currency: 'BRL'
    });
  } else {
    await subscription.update({
      plan,
      status: mapStripeStatus(stripeSub.status),
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      updatedAt: new Date()
    });
  }

  // CRÍTICO: Atualizar plano e limites do tenant
  await Tenant.update(
    { plan, maxBooks: planFeatures.maxBooks, maxStorageMB: planFeatures.maxStorageMB },
    { where: { id: tenantId } }
  );
}
```

---

### 9.2 `customer.subscription.updated`

Disparado quando uma subscription é modificada no Stripe (upgrade, downgrade, trial ending).

```js
async function handleSubscriptionUpdated(stripeSub) {
  const tenantId = stripeSub.metadata?.tenant_id;
  if (!tenantId) return;

  const subscription = await Subscription.findOne({
    where: { tenantId },
    include: [{ model: Tenant, as: 'tenant' }]
  });

  if (!subscription) return;

  await subscription.update({
    status: mapStripeStatus(stripeSub.status),
    currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    updatedAt: new Date()
  });

  // Sincronizar plano do tenant se houver divergência
  if (subscription.tenant && subscription.tenant.plan !== subscription.plan) {
    const planFeatures = PLAN_FEATURES[subscription.plan];
    await Tenant.update(
      { plan: subscription.plan, maxBooks: planFeatures.maxBooks, maxStorageMB: planFeatures.maxStorageMB },
      { where: { id: tenantId } }
    );
  }
}
```

---

### 9.3 `customer.subscription.deleted`

Disparado quando uma subscription é efetivamente cancelada. **Reverte o tenant para o plano Free.**

```js
async function handleSubscriptionDeleted(stripeSub) {
  const tenantId = stripeSub.metadata?.tenant_id;
  if (!tenantId) return;

  const subscription = await Subscription.findOne({ where: { tenantId } });

  if (subscription) {
    await subscription.update({
      status: SubscriptionStatus.Cancelled,
      endedAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Reverter tenant para Free
  const freeLimits = PLAN_FEATURES[0];
  await Tenant.update(
    { plan: 0, maxBooks: freeLimits.maxBooks, maxStorageMB: freeLimits.maxStorageMB },
    { where: { id: tenantId } }
  );
}
```

---

### 9.4 `invoice.payment_succeeded`

Registra o pagamento bem-sucedido no banco.

```js
async function handlePaymentSucceeded(invoice) {
  if (!invoice.subscription) return;

  const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription);
  const tenantId = stripeSub.metadata?.tenant_id;
  if (!tenantId) return;

  await Payment.create({
    tenantId,
    stripePaymentIntentId: invoice.payment_intent || invoice.id,
    stripeInvoiceId: invoice.id,
    amount: invoice.amount_paid / 100,   // centavos → reais
    currency: invoice.currency.toUpperCase(),
    status: PaymentStatus.Succeeded,
    description: invoice.description,
    paidAt: new Date(),
    invoiceUrl: invoice.hosted_invoice_url,
    invoicePdfUrl: invoice.invoice_pdf
  });
}
```

---

### 9.5 `invoice.payment_failed`

Registra a falha de pagamento no banco.

```js
async function handlePaymentFailed(invoice) {
  if (!invoice.subscription) return;

  const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription);
  const tenantId = stripeSub.metadata?.tenant_id;
  if (!tenantId) return;

  await Payment.create({
    tenantId,
    stripePaymentIntentId: invoice.payment_intent || invoice.id,
    stripeInvoiceId: invoice.id,
    amount: invoice.amount_due / 100,
    currency: invoice.currency.toUpperCase(),
    status: PaymentStatus.Failed,
    description: invoice.description,
    failedAt: new Date(),
    failureMessage: 'Pagamento falhou'
  });
}
```

---

## 10. Telas React

### 10.1 Portal de Cobrança

**Rota:** `/billing`

**Seções da tela:**

#### Sem assinatura (plano Free)

```
[Alert Info]
"Você está no plano gratuito."
[Link] → /billing/upgrade
```

#### Com assinatura ativa

**Card "Detalhes da Assinatura":**

```
Plano Atual: [badge Premium / Pro]
Status:      [badge Ativo / Trial / Cancelado / Pagamento Pendente]
Valor Mensal: R$ 9,90
Período Atual: 01/06/2025 - 01/07/2025

[Se trial ativo]  Trial Termina em: 08/06/2025
[Se cancel agendado] ⚠ Cancelamento agendado para 01/07/2025

Botões:
  [Upgrade de Plano]
  [Gerenciar Pagamento] → redireciona para Stripe Customer Portal
  [Cancelar Assinatura] → abre modal de confirmação

[Se cancelAtPeriodEnd=true]
  [Reativar Assinatura] → POST /api/billing/reactivate
```

**Card "Próxima Fatura":**

```
R$ 9,90
Vence em 01/07/2025
```

**Tabela "Histórico de Pagamentos":**

| Data | Descrição | Valor | Status | Fatura |
|---|---|---|---|---|
| 01/06/2025 | Subscription update | R$ 9,90 | ✅ Pago | [PDF] [Ver] |

**Modal de cancelamento:**

```
Tem certeza que deseja cancelar?

( ) Cancelar no fim do período (01/07/2025) — Você ainda terá acesso até lá
( ) Cancelar imediatamente — Perda de acesso imediata

[Cancelar]  [Confirmar Cancelamento]
```

---

### 10.2 Upgrade de Plano

**Rota:** `/billing/upgrade`

**Cards de plano** (exibir Free, Premium e Pro — ocultar MasterAdmin):

```
┌─────────────┐  ┌──────────────────┐  ┌─────────────┐
│    Free      │  │   ⭐ POPULAR      │  │     Pro     │
│  R$ 0,00/mês │  │ Premium          │  │ R$19,90/mês │
│             │  │ R$ 9,90/mês      │  │  14 dias    │
│ • 25 livros │  │  7 dias grátis   │  │  grátis     │
│ • 25MB      │  │ • 100 livros     │  │ • Ilimitado │
│ • ...       │  │ • 100MB          │  │ • 5GB       │
│             │  │ • ...            │  │ • ...       │
│[Plano Atual]│  │[Assinar Premium] │  │[Assinar Pro]│
└─────────────┘  └──────────────────┘  └─────────────┘
```

**Comportamento dos botões:**

- Se o plano é o **atual** → botão desabilitado ("Plano Atual")
- Se é **downgrade para Free** → mostrar informação "Cancele sua assinatura para voltar ao Free"
- Outros casos → botão "Assinar [Plano]" → POST `/api/billing/upgrade`

**Após POST:**

```js
const response = await billingService.upgrade(plan);

if (response.checkoutUrl) {
  // Novo assinante → redirecionar para Stripe
  window.location.href = response.checkoutUrl;
} else {
  // Já era assinante → atualização direta
  // Salvar novo token no localStorage/context
  updateToken(response.newToken);
  toast.success(response.message);
  navigate('/billing');
}
```

---

### 10.3 Telas de Erro/Status

| Rota | Quando exibir |
|---|---|
| `/billing/subscription-issue` | Quando `status` é `PastDue`, `Suspended` ou `Incomplete` |
| `/billing/expired` | Quando a assinatura expirou |
| `/billing/trial-expired` | Quando o período trial terminou sem upgrade |

**`/billing/subscription-issue`** — exibe botão para abrir o Stripe Customer Portal e regularizar o pagamento.

**`/billing/expired`** — exibe botão para ir à página de Upgrade.

**`/billing/trial-expired`** — exibe os cards de plano e incentiva o upgrade.

---

## 11. Estrutura de Pastas Sugerida

### Backend

```
src/
├── lib/
│   └── stripe.js                    # instância do Stripe
├── middleware/
│   └── requireAuth.js
├── routes/
│   ├── billing.js                   # /api/billing/*
│   └── webhook.js                   # /webhook/stripe
├── controllers/
│   ├── billingController.js
│   └── webhookController.js
├── services/
│   └── paymentService.js            # toda lógica de Stripe
├── helpers/
│   └── planLimits.js                # PLAN_FEATURES, getStripePriceId
└── models/
    ├── Subscription.js
    ├── Payment.js
    └── BillingAddress.js
```

### Frontend React

```
src/
├── pages/
│   └── billing/
│       ├── BillingPortal.jsx        # /billing
│       ├── Upgrade.jsx              # /billing/upgrade
│       ├── SubscriptionIssue.jsx    # /billing/subscription-issue
│       ├── Expired.jsx              # /billing/expired
│       └── TrialExpired.jsx         # /billing/trial-expired
├── components/
│   └── billing/
│       ├── SubscriptionCard.jsx
│       ├── PlanCard.jsx
│       ├── PaymentHistoryTable.jsx
│       ├── UpcomingInvoiceCard.jsx
│       └── CancelModal.jsx
└── services/
    └── billingService.js
```

### `billingService.js`

```js
import api from './api'; // axios com token

const billingService = {
  getPortal: (checkoutSuccess) =>
    api.get('/billing', { params: checkoutSuccess ? { checkoutSuccess: true } : {} }),

  upgrade: (plan) =>
    api.post('/billing/upgrade', { plan }),

  cancel: (immediately = false) =>
    api.post('/billing/cancel', { immediately }),

  reactivate: () =>
    api.post('/billing/reactivate'),

  getPortalUrl: () =>
    api.get('/billing/portal'),
};

export default billingService;
```

---

## 12. Mapeamento de Status do Stripe

| Stripe Status | Sistema Status | Label |
|---|---|---|
| `trialing` | `Trial` (0) | Trial |
| `active` | `Active` (1) | Ativa |
| `past_due` | `PastDue` (5) | Aguardando Pagamento |
| `canceled` | `Cancelled` (3) | Cancelada |
| `unpaid` | `Suspended` (2) | Suspensa |
| `incomplete` | `Incomplete` (6) | Incompleta |
| `incomplete_expired` | `Expired` (4) | Expirada |

---

## 13. Quirks e Pontos Críticos

| Ponto | Detalhe |
|---|---|
| **Raw body no webhook** | O webhook do Stripe valida a assinatura usando o **corpo cru** da requisição. Não use `express.json()` nessa rota. Use `express.raw({ type: 'application/json' })`. |
| **Price ID vs Product ID** | O campo `STRIPE_PRICE_PREMIUM` deve ser um **Price ID** (`price_xxx`), não um Product ID (`prod_xxx`). |
| **Proração** | Ao atualizar o plano de uma assinatura ativa, o Stripe gera automaticamente uma fatura de proração. Isso é controlado por `proration_behavior: 'create_prorations'`. |
| **Webhook vs Checkout Success** | O webhook pode demorar para chegar. O sistema implementa um **fallback manual** com retries (5s → 3s → 2s) ao detectar `?checkoutSuccess=true`. |
| **JWT / Claims** | Após upgrade direto (sem checkout), o token JWT precisa ser **renovado** com o novo plano. No frontend, atualize o token no `localStorage` / `AuthContext`. |
| **Cancelamento no fim do período** | `cancelAtPeriodEnd=true` não cancela imediatamente. O usuário ainda tem acesso até `currentPeriodEnd`. A subscription só é deletada quando o webhook `customer.subscription.deleted` chegar. |
| **Reverter para Free** | Quando `customer.subscription.deleted` chega via webhook, o tenant deve ser revertido para o plano **Free** com os limites correspondentes (25 livros, 25MB). |
| **Moeda** | Todos os valores são armazenados em **Reais (BRL)**. O Stripe armazena em **centavos** — divida por 100 ao salvar e multiplique por 100 ao enviar. |
| **Metadata obrigatória** | Sempre inclua `tenant_id` e `plan` nos metadados da subscription ao criar no Stripe. Os webhooks dependem desses campos para identificar o tenant. |
| **Stripe Customer Portal** | Requer configuração no Dashboard do Stripe: **Settings → Billing → Customer Portal**. Habilite as opções desejadas (cancelar, atualizar cartão, etc.). |
| **Teste de Webhooks** | Use o Stripe CLI para testar localmente: `stripe listen --forward-to localhost:3000/webhook/stripe`. |
| **Timestamps do Stripe** | O Stripe retorna timestamps Unix (segundos). Converta com `new Date(ts * 1000)` ao salvar no banco. |
