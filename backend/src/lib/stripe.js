const Stripe = require("stripe");

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn("⚠️  STRIPE_SECRET_KEY não configurado. Billing desabilitado.");
}

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

module.exports = stripe;
