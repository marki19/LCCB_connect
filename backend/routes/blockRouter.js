const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const { requireVerified } = require("../middleware/auth");

// Mounted at /api/blocks. `blockedId` is a body field on POST and a path
// parameter on DELETE, matching the client in frontend/src/lib/api.ts.
router.post("/", requireVerified, postController.blockUser);
router.get("/", requireVerified, postController.listBlocked);
router.delete("/:blockedId", requireVerified, postController.unblockUser);

module.exports = router;
