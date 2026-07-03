const { prisma, cors, requireAuth } = require("./_lib");

// Replace {{name}}, {{client}}, {{designation}}, {{owner}} placeholders with candidate data
const applyTemplate = (tpl, c) => {
  return String(tpl || "")
    .replace(/{{\s*name\s*}}/gi, c.candidateName || "")
    .replace(/{{\s*client\s*}}/gi, c.clientName || "")
    .replace(/{{\s*designation\s*}}/gi, c.designation || "")
    .replace(/{{\s*owner\s*}}/gi, c.ownerName || "")
    .replace(/{{\s*status\s*}}/gi, c.joiningStatus || "");
};

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const user = requireAuth(req, res);
  if (!user) return;
  if (!["admin", "recruiter"].includes(user.role)) return res.status(403).json({ error: "Not allowed" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { channel, candidateIds, subject, message, attachment } = req.body || {};
    // attachment (optional) = { filename, base64, contentType }

    if (!channel || !["email", "whatsapp"].includes(channel))
      return res.status(400).json({ error: "channel must be 'email' or 'whatsapp'" });
    if (!Array.isArray(candidateIds) || candidateIds.length === 0)
      return res.status(400).json({ error: "candidateIds is required" });
    if (!message) return res.status(400).json({ error: "message is required" });

    const candidates = await prisma.candidate.findMany({
      where: { id: { in: candidateIds.map(Number) }, deleted: false },
    });

    // ─── EMAIL ────────────────────────────────────────────────────────────
    if (channel === "email") {
      const host = process.env.SMTP_HOST;
      if (!host) {
        return res.status(400).json({
          error: "Email is not configured yet. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in the environment to enable bulk email.",
        });
      }
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

      const results = { sent: [], failed: [] };
      for (const c of candidates) {
        if (!c.email) { results.failed.push({ id: c.id, name: c.candidateName, reason: "No email on file" }); continue; }
        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: c.email,
            subject: applyTemplate(subject || "", c) || "Update from Ample Leap",
            text: applyTemplate(message, c),
            attachments: attachment
              ? [{ filename: attachment.filename, content: Buffer.from(attachment.base64, "base64"), contentType: attachment.contentType }]
              : [],
          });
          results.sent.push({ id: c.id, name: c.candidateName, email: c.email });
        } catch (err) {
          results.failed.push({ id: c.id, name: c.candidateName, reason: err.message });
        }
      }

      await prisma.auditLog.create({
        data: { action: "Bulk Email", detail: `Sent to ${results.sent.length}/${candidates.length} candidates`, userId: user.id },
      });

      return res.json(results);
    }

    // ─── WHATSAPP ─────────────────────────────────────────────────────────
    if (channel === "whatsapp") {
      const token = process.env.WHATSAPP_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_ID;

      const cleanPhone = (p) => {
        if (!p) return null;
        const digits = String(p).replace(/\D/g, "");
        return digits.length === 10 ? "91" + digits : digits;
      };

      // If Meta WhatsApp Cloud API credentials are configured, send server-side
      // (this is the only way to truly bulk-send with an attachment).
      if (token && phoneId) {
        const results = { sent: [], failed: [] };
        for (const c of candidates) {
          const num = cleanPhone(c.phone);
          if (!num) { results.failed.push({ id: c.id, name: c.candidateName, reason: "No phone on file" }); continue; }
          try {
            const body = {
              messaging_product: "whatsapp",
              to: num,
              type: "text",
              text: { body: applyTemplate(message, c) },
            };
            const r = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify(body),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error?.message || "Send failed");
            results.sent.push({ id: c.id, name: c.candidateName, phone: num });
          } catch (err) {
            results.failed.push({ id: c.id, name: c.candidateName, reason: err.message });
          }
        }
        await prisma.auditLog.create({
          data: { action: "Bulk WhatsApp", detail: `Sent to ${results.sent.length}/${candidates.length} candidates via WhatsApp Cloud API`, userId: user.id },
        });
        return res.json({ ...results, mode: "api" });
      }

      // Fallback: no WhatsApp Business API configured. Return a queue of
      // wa.me links — the frontend opens these one at a time. Note: wa.me
      // links cannot carry an attachment (a WhatsApp/browser platform
      // limitation), so any attachment must be attached manually in the
      // WhatsApp window that opens.
      const queue = candidates
        .map((c) => {
          const num = cleanPhone(c.phone);
          if (!num) return null;
          return {
            id: c.id,
            name: c.candidateName,
            phone: num,
            url: `https://wa.me/${num}?text=${encodeURIComponent(applyTemplate(message, c))}`,
          };
        })
        .filter(Boolean);

      const skipped = candidates.filter((c) => !cleanPhone(c.phone)).map((c) => ({ id: c.id, name: c.candidateName, reason: "No phone on file" }));

      await prisma.auditLog.create({
        data: { action: "Bulk WhatsApp (manual)", detail: `Queued ${queue.length}/${candidates.length} candidates (no WhatsApp API configured)`, userId: user.id },
      });

      return res.json({ mode: "manual", queue, skipped, hasAttachment: !!attachment });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
