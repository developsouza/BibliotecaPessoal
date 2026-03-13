const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { requirePlan } = require("../middleware/requirePlan");
const { searchBooks, importBook, enrichBook } = require("../controllers/googleBooks.controller");

// Apenas planos pagos podem usar o Google Books
const paidOnly = [auth, requirePlan("premium", "pro", "master")];

router.get("/search", ...paidOnly, searchBooks);
router.post("/import", ...paidOnly, importBook);
router.post("/enrich/:id", ...paidOnly, enrichBook);

module.exports = router;
