require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");

// Import routes
const authRoutes = require("./routes/auth.routes");
const booksRoutes = require("./routes/books.routes");
const categoriesRoutes = require("./routes/categories.routes");
const readingRoutes = require("./routes/reading.routes");
const loansRoutes = require("./routes/loans.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const shelfRoutes = require("./routes/shelf.routes");
const gamificationRoutes = require("./routes/gamification.routes");
const statisticsRoutes = require("./routes/statistics.routes");
const googleBooksRoutes = require("./routes/googleBooks.routes");
const adminRoutes = require("./routes/admin.routes");
const tenantRoutes = require("./routes/tenant.routes");
const billingRoutes = require("./routes/billing.routes");
const webhookRoutes = require("./routes/webhook.routes");

const app = express();

// CORS
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true,
    }),
);

// ⚠️  Webhook do Stripe — DEVE vir ANTES do express.json() para receber o raw body
app.use("/webhook", webhookRoutes);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200,
    message: { error: "Muitas requisições, tente novamente em 15 minutos." },
});
app.use("/api", limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Servir arquivos de upload
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Rotas
app.use("/api/auth", authRoutes);
app.use("/api/books", booksRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/reading", readingRoutes);
app.use("/api/loans", loansRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/shelf", shelfRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/google-books", googleBooksRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/tenant", tenantRoutes);
app.use("/api/billing", billingRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Rota não encontrada" });
});

// Error handler global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Erro interno do servidor", details: err.message });
});

module.exports = app;
