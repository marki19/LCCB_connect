/**
 * Transactional email for signup and account notices.
 *
 * Uses nodemailer with SMTP config from environment variables. In development
 * missing SMTP config degrades to a console notice; in production it throws so
 * a misconfigured deploy fails loudly instead of silently dropping codes.
 */

const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { escapeHtml, singleLine } = require("../utils/html");

let transporter = null;

const isProduction = () => process.env.NODE_ENV === "production";

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    if (isProduction()) {
      throw new Error("[email] SMTP is not configured; refusing to drop mail silently");
    }
    console.warn("[email] SMTP not configured - emails will be logged to console only");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: parseInt(SMTP_PORT, 10) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

function fromAddress() {
  return process.env.SMTP_FROM || "LCCB Connect <noreply@lccbconnect.app>";
}

async function deliver({ to, subject, text, html, devNote }) {
  const tx = getTransporter();

  if (!tx) {
    console.log(`\n[DEV EMAIL] To: ${to}\n${devNote}\n`);
    return { dev: true };
  }

  const info = await tx.sendMail({ from: fromAddress(), to, subject, text, html });
  console.log("[email] Sent via SMTP");
  return info;
}

async function sendOtpEmail({ to, otpCode, fullName, expiresMinutes = 10 }) {
  // fullName is user-controlled; nothing else here is.
  const safeName = escapeHtml(singleLine(fullName, 80) || "there");

  // Unique per-email marker to prevent Gmail "quoted text" clustering
  const requestId = crypto.randomBytes(4).toString("hex");

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a2e;">Verify your email</h2>
      <p>Hi ${safeName},</p>
      <p>Your verification code is:</p>
      <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #1a1a2e;">${otpCode}</span>
      </div>
      <p style="color: #666;">This code expires in ${expiresMinutes} minutes.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">If you didn't request this, you can ignore this email.</p>
      <!-- ${requestId} -->
    </div>
  `;

  const text = `
Verify your email

Hi ${safeName}

Your verification code is: ${otpCode}

This code expires in ${expiresMinutes} minutes.

If you didn't request this, you can ignore this email.
---
${requestId}
  `;

  // The code is deliberately never logged: console output ends up in log
  // aggregators and shell history.
  return deliver({
    to,
    subject: `Your LCCB Connect verification code (${requestId})`,
    text,
    html,
    devNote: `Expires: ${expiresMinutes} min (code suppressed)`,
  });
}

/**
 * Tells an existing account owner that someone tried to register with their
 * address. Carries no code and no link with a token.
 */
async function sendAccountExistsEmail({ to }) {
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a2e;">You already have an account</h2>
      <p>Someone tried to sign up for LCCB Connect with this address.</p>
      <p>If that was you, sign in instead. If you forgot your password, use the reset option on the login screen.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">If this wasn't you, you can ignore this email. Your account is unchanged.</p>
    </div>
  `;

  const text = `
You already have an account

Someone tried to sign up for LCCB Connect with this address.

If that was you, sign in instead. If you forgot your password, use the reset option on the login screen.

If this wasn't you, you can ignore this email. Your account is unchanged.
  `;

  return deliver({
    to,
    subject: "Your LCCB Connect account already exists",
    text,
    html,
    devNote: "Account-exists notice",
  });
}

/**
 * Password reset OTP email. Same template shape as the signup code so the
 * unique requestId marker still busts Gmail's quoted-text clustering.
 *
 * The subject is deliberately different from the signup email so the two
 * flows are distinguishable in an inbox, but neither the subject nor the
 * body carries any account-specific state that could confirm or deny the
 * address is registered.
 */
async function sendPasswordResetOtpEmail({ to, otpCode, fullName, expiresMinutes = 10 }) {
  const safeName = escapeHtml(singleLine(fullName, 80) || "there");
  const requestId = crypto.randomBytes(4).toString("hex");

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a2e;">Reset your password</h2>
      <p>Hi ${safeName},</p>
      <p>Use this code to set a new password:</p>
      <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #1a1a2e;">${otpCode}</span>
      </div>
      <p style="color: #666;">This code expires in ${expiresMinutes} minutes.</p>
      <p style="color: #666; font-size: 14px;">If you set a new password you will be signed out on other devices.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">If you didn't request this, you can ignore this email. Your password is unchanged.</p>
      <!-- ${requestId} -->
    </div>
  `;

  const text = `
Reset your password

Hi ${safeName}

Your reset code is: ${otpCode}

This code expires in ${expiresMinutes} minutes.
After you set a new password you will be signed out on other devices.

If you didn't request this, you can ignore this email. Your password is unchanged.
---
${requestId}
  `;

  return deliver({
    to,
    subject: `Your LCCB Connect password reset code (${requestId})`,
    text,
    html,
    devNote: `Expires: ${expiresMinutes} min (code suppressed)`,
  });
}

module.exports = { sendOtpEmail, sendAccountExistsEmail, sendPasswordResetOtpEmail };
