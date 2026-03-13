const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/categories.controller");

router.get("/", auth, ctrl.listCategories);
router.post("/", auth, ctrl.createCategory);
router.put("/:id", auth, ctrl.updateCategory);
router.delete("/:id", auth, ctrl.deleteCategory);

module.exports = router;
