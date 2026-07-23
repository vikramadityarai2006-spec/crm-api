// Shared SMTP mailer.
//
// Uses your COMPANY mail server — not Gmail/Google. Configure these
// environment variables in Vercel (Settings -> Environment Variables):
//
//   SMTP_HOST    e.g. mail.ampleleap.com
//   SMTP_PORT    587 (STARTTLS) or 465 (SSL)
//   SMTP_SECURE  "false" for port 587, "true" for port 465
//   SMTP_USER    the mailbox login
//   SMTP_PASS    the mailbox password
//   SMTP_FROM    e.g. Ample Leap <hr@ampleleap.com>
//
// isMailConfigured() lets callers give a clear message instead of a stack
// trace when the variables have not been set yet.

const isMailConfigured = () => Boolean(process.env.SMTP_HOST);

const getTransporter = () => {
  if (!isMailConfigured()) return null;
  const nodemailer = require("nodemailer");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Nodemailer defaults wait minutes. On a serverless function that just
    // burns the invocation limit and returns an HTML crash page instead of a
    // usable error, so fail fast and report something actionable.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
};

// Turns raw SMTP failures into guidance that points at the actual setting.
const explainMailError = (err) => {
  const code = (err && err.code) || "";
  const msg  = (err && err.message) || "Unknown mail error";
  if (code === "EAUTH" || /535|auth/i.test(msg))
    return "SMTP login rejected. Check SMTP_USER and SMTP_PASS — the username is usually the full email address.";
  if (code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ECONNREFUSED" || /timeout/i.test(msg))
    return "Could not reach the mail server. Check SMTP_HOST and SMTP_PORT, and that your provider allows connections from outside your office network.";
  if (code === "ESOCKET" || /certificate|SSL|wrong version/i.test(msg))
    return "Secure-connection mismatch. Use SMTP_SECURE=true with port 465, or SMTP_SECURE=false with port 587.";
  return `Mail server error: ${msg}`;
};

// Confirms the server is reachable and the credentials work, before any send.
const verifyTransport = async () => {
  const transporter = getTransporter();
  if (!transporter) return { ok: false, error: "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS and SMTP_FROM." };
  try {
    await transporter.verify();
    return { ok: true, transporter };
  } catch (err) {
    return { ok: false, error: explainMailError(err) };
  }
};

const fromAddress = () => process.env.SMTP_FROM || process.env.SMTP_USER;

// Sends a login verification code. Throws on failure so the caller can
// refuse the login rather than let someone in without verification.
const sendOtpEmail = async (to, name, code, minutes) => {
  const transporter = getTransporter();
  if (!transporter) throw new Error("SMTP is not configured");

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: `Your login code: ${code}`,
    text:
      `Hi ${name},\n\n` +
      `Your verification code is ${code}\n\n` +
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
         <p style="color:#5f6368;font-size:13px">
           Expires in ${minutes} minutes and can be used once.
         </p>
         <p style="color:#5f6368;font-size:12px;border-top:1px solid #e0e0e0;padding-top:12px">
           If you did not try to sign in, ignore this email and tell your administrator.
         </p>
       </div>`,
  });
};

module.exports = { isMailConfigured, getTransporter, fromAddress, sendOtpEmail, verifyTransport, explainMailError };
