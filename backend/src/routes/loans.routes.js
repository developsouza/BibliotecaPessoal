const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/loans.controller");

router.get("/active", auth, ctrl.listActive);
router.get("/", auth, ctrl.listLoans);
router.post("/", auth, ctrl.createLoan);
router.put("/:id/return", auth, ctrl.returnLoan);
router.delete("/:id", auth, ctrl.deleteLoan);

module.exports = router;
