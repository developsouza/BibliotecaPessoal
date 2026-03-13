function requirePlan(...plans) {
    return (req, res, next) => {
        if (!plans.includes(req.user.plan)) {
            return res.status(403).json({
                error: "Plano insuficiente",
                requiredPlans: plans,
                currentPlan: req.user.plan,
                upgradeUrl: "/billing",
            });
        }
        next();
    };
}

function requireAdmin(req, res, next) {
    if (!req.user.isMasterAdmin) {
        return res.status(403).json({ error: "Acesso restrito a administradores" });
    }
    next();
}

module.exports = { requirePlan, requireAdmin };
