const crypto = require("crypto");
const userModel = require("../models/userModel");
const { record, ACTIONS } = require("../services/auditService");
const { brevoWebhookSchema } = require("../validation");

/**
 * Brevo webhook endpoint for email bounce events.
 * POST /api/email/webhook/brevo
 *
 * Verifies HMAC signature (X-Brevo-Signature header) before processing.
 * Only handles hard bounces with code 550 (550 5.1.1 - email does not exist).
 * Marks profile as bounced to prevent future email sends.
 */
async function brevoWebhook(req, res, next) {
  try {
    // Verify HMAC signature
    const signature = req.headers["x-brevo-signature"];
    const webhookSecret = process.env.BREVO_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("[brevo-webhook] BREVO_WEBHOOK_SECRET not configured");
      return res.status(500).json({
        error: "Webhook secret not configured",
        code: "webhook_secret_missing",
      });
    }

    if (!signature) {
      return res.status(401).json({
        error: "Missing signature header",
        code: "missing_signature",
      });
    }

    // Brevo signs the raw request body bytes. express.json() has already
    // parsed req.body into a JS object by the time this runs, so we can't
    // reconstruct the exact bytes from JSON.stringify. The route uses
    // express.raw() to give us the Buffer instead.
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    // Constant-time comparison (handles different lengths safely)
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.warn("[brevo-webhook] Invalid signature");
      return res.status(401).json({
        error: "Invalid signature",
        code: "invalid_signature",
      });
    }

    // Parse the raw body into an object for processing
    let body;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch (parseErr) {
      console.error("[brevo-webhook] Failed to parse JSON body:", parseErr.message);
      return res.status(400).json({
        error: "Invalid JSON body",
        code: "invalid_json",
      });
    }

    // Validate the parsed body against the schema
    const validationResult = brevoWebhookSchema.safeParse(body);
    if (!validationResult.success) {
      console.warn("[brevo-webhook] Validation failed:", validationResult.error.issues);
      return res.status(400).json({
        error: "Validation failed",
        code: "invalid_payload",
        fields: validationResult.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { event, email, reason, code, type, timestamp } = validationResult.data;

    if (!email && event === "bounce" && type === "hard" && String(code) === "550") {
      return res.status(400).json({
        error: "Email missing from payload",
        code: "missing_email",
      });
    }

    // Only process hard bounces with code 550
    if (event !== "bounce" || type !== "hard" || String(code) !== "550") {
      // Acknowledge but ignore other events
      return res.json({ received: true, processed: false, reason: "not_hard_bounce_550" });
    }

    const normalizedEmail = email.toLowerCase();

    // Update profile: mark as bounced
    const result = await userModel.updateBouncedEmail(normalizedEmail, reason, new Date(timestamp * 1000));

    if (result) {
      // Log to audit trail
      await record({
        actor: { id: result.id, role: result.role },
        action: ACTIONS.EMAIL_BOUNCE_HARD,
        targetType: "user",
        targetId: result.id,
        metadata: {
          email: normalizedEmail,
          bounce_code: code,
          bounce_type: type,
          bounce_reason: reason,
          bounce_timestamp: timestamp,
        },
      });

      console.log(`[brevo-webhook] Marked ${normalizedEmail} as bounced (user: ${result.id})`);
    } else {
      console.log(`[brevo-webhook] Email ${normalizedEmail} not found in profiles, still acknowledging`);
    }

    return res.json({ received: true, processed: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  brevoWebhook,
};