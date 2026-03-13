const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const ctrl = require("../controllers/auth.controller");

// Públicas
router.post("/register", ctrl.register);
router.post("/login", ctrl.login);

// Protegidas
router.get("/me", auth, ctrl.getMe);
router.put("/profile", auth, upload.avatar.single("avatarFile"), ctrl.updateProfile);
router.post("/change-password", auth, ctrl.changePassword);

module.exports = router;
