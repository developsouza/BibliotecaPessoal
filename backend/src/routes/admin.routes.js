const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requirePlan");
const {
    getAdminDashboard,
    getTenants,
    getTenantDetail,
    updateTenant,
    updateTenantPlan,
    createTenant,
    toggleActiveTenant,
    deleteTenant,
} = require("../controllers/admin.controller");

router.get("/dashboard", auth, requireAdmin, getAdminDashboard);
router.get("/tenants", auth, requireAdmin, getTenants);
router.post("/tenants", auth, requireAdmin, createTenant);
router.get("/tenants/:id", auth, requireAdmin, getTenantDetail);
router.put("/tenants/:id", auth, requireAdmin, updateTenant);
router.put("/tenants/:id/plan", auth, requireAdmin, updateTenantPlan);
router.patch("/tenants/:id/toggle-active", auth, requireAdmin, toggleActiveTenant);
router.delete("/tenants/:id", auth, requireAdmin, deleteTenant);

module.exports = router;
