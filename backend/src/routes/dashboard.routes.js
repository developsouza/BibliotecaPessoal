const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/dashboard.controller");

router.get("/", auth, ctrl.getDashboard);
router.post("/clear-cache", auth, ctrl.clearDashboardCache);

module.exports = router;
