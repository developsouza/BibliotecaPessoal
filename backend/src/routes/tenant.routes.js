const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getTenantUsage, getTenantSetup, joinTenant, updateTenantSetup, regenerateInviteCode } = require("../controllers/tenant.controller");

router.get("/usage", auth, getTenantUsage);
router.get("/setup", auth, getTenantSetup);
router.patch("/setup", auth, updateTenantSetup);
router.post("/join", auth, joinTenant);
router.post("/regenerate-invite", auth, regenerateInviteCode);

module.exports = router;
