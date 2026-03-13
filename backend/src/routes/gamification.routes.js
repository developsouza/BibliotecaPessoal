const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { requirePlan } = require("../middleware/requirePlan");
const {
    getGamification,
    updateYearlyGoal,
    recalculateProgress,
    diagnosticProgress,
    getLeaderboard,
    markViewed,
} = require("../controllers/gamification.controller");

router.get("/diagnostic", auth, diagnosticProgress);
router.get("/leaderboard", auth, requirePlan("premium", "pro", "master"), getLeaderboard);
router.get("/", auth, getGamification);
router.put("/goal", auth, updateYearlyGoal);
router.post("/recalculate", auth, recalculateProgress);
router.post("/mark-viewed", auth, markViewed);

module.exports = router;
