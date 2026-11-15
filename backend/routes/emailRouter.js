const express = require("express");
const router = express.Router();
const { brevoWebhook } = require("../controllers/emailWebhookController");

/**
 * POST /api/email/webhook/brevo
 *
 * Brevo webhook endpoint for email bounce events.
 * Verifies HMAC signature (X-Brevo-Signature header).
 * Only processes hard bounces with code 550.
 * Returns 200 quickly to satisfy Brevo's webhook timeout.
 *
 * CRITICAL: Raw body capture is done in app.js BEFORE express.json()
 * so req.body is a Buffer for HMAC verification.
 */
router.post("/webhook/brevo", brevoWebhook);

module.exports = router;