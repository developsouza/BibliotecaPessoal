const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const billingController = require("../controllers/billing.controller");

// GET /api/billing — Portal de cobrança (com suporte a ?checkoutSuccess=true)
router.get("/", authMiddleware, billingController.getPortal);

// GET /api/billing/portal — Redirecionar para Stripe Customer Portal
router.get("/portal", authMiddleware, billingController.getStripePortal);

// POST /api/billing/upgrade — Upgrade por plano
router.post("/upgrade", authMiddleware, billingController.upgradePlan);

// POST /api/billing/cancel — Cancelar assinatura
router.post("/cancel", authMiddleware, billingController.cancelSubscription);

// POST /api/billing/reactivate — Reativar assinatura
router.post("/reactivate", authMiddleware, billingController.reactivateSubscription);

module.exports = router;
