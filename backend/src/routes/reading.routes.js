const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/reading.controller");

// Rotas estáticas antes de :id
router.get("/history", auth, ctrl.getHistory);
router.get("/latest", auth, ctrl.getLatestReading);
router.get("/book/:bookId", auth, ctrl.getBookProgress);
router.get("/", auth, ctrl.listReading);
router.post("/", auth, ctrl.upsertProgress);
router.patch("/:id/page", auth, ctrl.updatePage);
router.delete("/:id", auth, ctrl.deleteProgress);

module.exports = router;
