// Shared mailer.
//
// IMPORTANT: Vercel's serverless sandbox blocks outbound SMTP connections, so
// Nodemailer just hangs until the function is killed. That is why raw SMTP to
// GoDaddy (or any provider) times out in production. Mail is therefore sent
// over HTTPS through an email API instead.
//
// You still send FROM your own company address — only the delivery path
// changes. Verify ampleleap.com with the provider first (they give you a few
// DNS records to add in GoDaddy), then set ONE of these in Vercel:
//
//   RESEND_API_KEY   — from resend.com
//   BREVO_API_KEY    — from brevo.com
//
// Plus, in both cases:
//   MAIL_FROM        e.g. Ample Leap <info@ampleleap.com>
//
// SMTP_* is still honoured as a fallback for non-Vercel hosting, where SMTP
// works normally.

const RESEND_KEY = () => process.env.RESEND_API_KEY;
const BREVO_KEY  = () => process.env.BREVO_API_KEY;
const SMTP_HOST  = () => process.env.SMTP_HOST;

const isMailConfigured = () => Boolean(RESEND_KEY() || BREVO_KEY() || SMTP_HOST());

const activeProvider = () =>
  RESEND_KEY() ? "resend" : BREVO_KEY() ? "brevo" : SMTP_HOST() ? "smtp" : null;

const fromAddress = () =>
  process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "";

// "Ample Leap <info@ampleleap.com>" -> { name, email }
const splitFrom = (value) => {
  const m = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(value || "");
  if (m) return { name: m[1] || "Ample Leap", email: m[2] };
  return { name: "Ample Leap", email: (value || "").trim() };
};

// Turns provider failures into guidance that points at the actual setting.
const explainMailError = (err) => {
  const msg = (err && err.message) || "Unknown mail error";
  if (/timed? ?out|ETIMEDOUT|ECONNREFUSED|ECONNECTION/i.test(msg))
    return "Could not reach the mail service. Vercel blocks outbound SMTP — set RESEND_API_KEY or BREVO_API_KEY to send over HTTPS instead.";
  if (/401|403|unauthor|invalid.*key|api.?key/i.test(msg))
    return "The email API key was rejected. Check RESEND_API_KEY / BREVO_API_KEY in Vercel.";
  if (/domain|not verified|sender/i.test(msg))
    return "The sender address is not verified yet. Verify ampleleap.com with your email provider and add the DNS records they give you.";
  if (/EAUTH|535/i.test(msg))
    return "SMTP login rejected. Check SMTP_USER and SMTP_PASS — the username is the full email address.";
  return `Mail error: ${msg}`;
};

// ── Providers ───────────────────────────────────────────────────────────────

const sendViaResend = async ({ to, subject, text, html, attachments }) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject,
      text: text || undefined,
      html: html || undefined,
      attachments: (attachments || []).map(a => ({ filename: a.filename, content: a.base64 })),
    }),
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try { const j = await res.json(); detail = j.message || j.error || detail; } catch (e) {}
    throw new Error(detail);
  }
  return res.json();
};

const sendViaBrevo = async ({ to, subject, text, html, attachments }) => {
  const sender = splitFrom(fromAddress());
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_KEY(), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { email: sender.email, name: sender.name },
      to: [{ email: to }],
      subject,
      textContent: text || undefined,
      htmlContent: html || undefined,
      attachment: (attachments || []).length
        ? attachments.map(a => ({ name: a.filename, content: a.base64 }))
        : undefined,
    }),
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try { const j = await res.json(); detail = j.message || detail; } catch (e) {}
    throw new Error(detail);
  }
  return res.json();
};

const sendViaSmtp = async ({ to, subject, text, html, attachments }) => {
  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Fail fast rather than burn the whole function timeout.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
  return transporter.sendMail({
    from: fromAddress(),
    to, subject,
    text: text || undefined,
    html: html || undefined,
    attachments: (attachments || []).map(a => ({
      filename: a.filename,
      content: Buffer.from(a.base64, "base64"),
      contentType: a.contentType,
    })),
  });
};

// ── Public API ──────────────────────────────────────────────────────────────

// Unified send. `attachments` is [{ filename, base64, contentType }].
const sendMail = async (opts) => {
  const provider = activeProvider();
  if (!provider) throw new Error("No email provider configured");
  if (!fromAddress()) throw new Error("MAIL_FROM is not set");
  if (provider === "resend") return sendViaResend(opts);
  if (provider === "brevo")  return sendViaBrevo(opts);
  return sendViaSmtp(opts);
};

// Cheap pre-flight so a misconfiguration returns a clear message instead of
// failing part-way through a batch.
const verifyTransport = async () => {
  const provider = activeProvider();
  if (!provider)
    return { ok: false, error: "Email is not configured. Set RESEND_API_KEY (or BREVO_API_KEY) and MAIL_FROM in Vercel. Plain SMTP does not work on Vercel." };
  if (!fromAddress())
    return { ok: false, error: "MAIL_FROM is not set. Use a verified address, e.g. Ample Leap <info@ampleleap.com>." };
  if (provider === "smtp") {
    try {
      const nodemailer = require("nodemailer");
      const t = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
      });
      await t.verify();
    } catch (err) {
      return { ok: false, error: explainMailError(err) };
    }
  }
  return { ok: true, provider };
};

// Login verification code for recruiters. Throws on failure so the caller can
// refuse the login rather than let someone in unverified.
const sendOtpEmail = async (to, name, code, minutes) => {
  await sendMail({
    to,
    subject: `Your login code: ${code}`,
    text:
      `Hi ${name},\n\nYour verification code is ${code}\n\n` +
      `It expires in ${minutes} minutes and can be used once.\n\n` +
      `If you did not try to sign in, ignore this email and tell your administrator.\n`,
    html:
      `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
         <p style="color:#5f6368;font-size:13px;margin:0 0 4px">Ample Leap CRM</p>
         <h2 style="color:#001c3e;margin:0 0 16px">Your login code</h2>
         <p style="color:#3c4043;font-size:14px">Hi ${name},</p>
         <div style="background:#f1f3f4;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
           <span style="font-size:34px;font-weight:800;letter-spacing:8px;color:#001c3e">${code}</span>
         </div>
         <p style="color:#5f6368;font-size:13px">Expires in ${minutes} minutes and can be used once.</p>
         <p style="color:#5f6368;font-size:12px;border-top:1px solid #e0e0e0;padding-top:12px">
           If you did not try to sign in, ignore this email and tell your administrator.
         </p>
       </div>`,
  });
};

module.exports = {
  isMailConfigured, activeProvider, fromAddress,
  sendMail, verifyTransport, sendOtpEmail, explainMailError,
};
