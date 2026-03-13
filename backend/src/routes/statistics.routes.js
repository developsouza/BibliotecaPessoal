const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { requirePlan } = require("../middleware/requirePlan");
const { getStatistics, getShareCard } = require("../controllers/statistics.controller");

router.get("/share-card", auth, getShareCard);
router.get("/", auth, requirePlan("pro", "master"), getStatistics);

module.exports = router;
