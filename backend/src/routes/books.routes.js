const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const { requirePlan } = require("../middleware/requirePlan");
const ctrl = require("../controllers/books.controller");

// Ordem importa: rotas estáticas antes de :id
router.get("/autocomplete", auth, ctrl.autocomplete);
router.get("/export", auth, requirePlan("premium", "pro", "master"), ctrl.exportBooks);
router.get("/", auth, ctrl.listBooks);
router.get("/:id", auth, ctrl.getBook);
router.post("/", auth, upload.single("coverFile"), ctrl.createBook);
router.put("/:id", auth, upload.single("coverFile"), ctrl.updateBook);
router.patch("/:id/status", auth, ctrl.updateStatus);
router.delete("/:id", auth, ctrl.deleteBook);

module.exports = router;
