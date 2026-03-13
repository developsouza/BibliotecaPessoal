const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhook.controller");

// POST /webhook/stripe — Receber eventos do Stripe
// IMPORTANTE: raw body, sem express.json() — configurado no app.js
router.post("/stripe", express.raw({ type: "application/json" }), webhookController.handle);

module.exports = router;
