const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = global.prisma || new PrismaClient();
if (!global.prisma) global.prisma = prisma;
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET environment variable is not set. Refusing to start with an insecure default.");
}
// Session duration in seconds — default 8 hours (working day)
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || "8");

// ─── Two-factor (OTP) settings ────────────────────────────────────────────
// DISABLED by default — every role signs in with password only.
//
// To switch it back on, set the OTP_ROLES environment variable in Vercel to a
// comma-separated list of roles, e.g.  OTP_ROLES=recruiter
// Requires a working email provider (see api/_mailer.js), because a role
// listed here cannot sign in while email delivery is failing.
const OTP_ROLES = (process.env.OTP_ROLES || "")
  .split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
const OTP_MINUTES     = 10;
const OTP_MAX_ATTEMPTS = 5;
const { sendOtpEmail } = require("./_mailer");
// _lib performs the self-migration that adds the otp* columns to User. Awaiting
// its `ready` promise stops the first login after a deploy racing that patch.
const { ready: schemaReady } = require("./_lib");

const needsOtp = (user) => OTP_ROLES.includes(String(user.role || "").toLowerCase());
const makeOtp  = () => String(Math.floor(100000 + Math.random() * 900000));

const issueSession = async (user) => {
  const expiresIn = SESSION_HOURS * 3600;
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    SECRET,
    { expiresIn }
  );
  try {
    await prisma.auditLog.create({
      data: { action: "Login", recordName: user.name, detail: `${user.email} (${user.role})`, userId: user.id }
    });
  } catch (e) { /* ignore audit failure */ }
  return {
    token, expiresIn, sessionHours: SESSION_HOURS,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  };
};

module.exports = async (req, res) => {
  // Wait for the self-migration that adds the otp* columns BEFORE touching the
  // User table. Prisma selects all columns, so a findUnique would otherwise
  // throw "column User.otpHash does not exist" on the first request after deploy.
  await schemaReady;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // POST with { email, otp } = second step of recruiter two-factor login
  if (req.method === "POST" && req.body && req.body.otp !== undefined) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return res.status(400).json({ error: "Email and code required" });

      const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
      if (!user || !user.active) return res.status(401).json({ error: "Invalid credentials" });

      if (!user.otpHash || !user.otpExpires) {
        return res.status(400).json({ error: "No code pending. Please sign in again." });
      }
      if (new Date(user.otpExpires) < new Date()) {
        await prisma.user.update({ where: { id: user.id }, data: { otpHash: null, otpExpires: null, otpAttempts: 0 } });
        return res.status(401).json({ error: "That code has expired. Please sign in again." });
      }
      if ((user.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
        await prisma.user.update({ where: { id: user.id }, data: { otpHash: null, otpExpires: null, otpAttempts: 0 } });
        return res.status(429).json({ error: "Too many incorrect attempts. Please sign in again." });
      }

      const ok = await bcrypt.compare(String(otp).trim(), user.otpHash);
      if (!ok) {
        const attempts = (user.otpAttempts || 0) + 1;
        await prisma.user.update({ where: { id: user.id }, data: { otpAttempts: attempts } });
        const left = OTP_MAX_ATTEMPTS - attempts;
        return res.status(401).json({
          error: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many incorrect attempts. Please sign in again."
        });
      }

      // Correct — burn the code so it cannot be reused, then issue the session.
      await prisma.user.update({ where: { id: user.id }, data: { otpHash: null, otpExpires: null, otpAttempts: 0 } });
      return res.json(await issueSession(user));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST = Login (step one: email + password)
  if (req.method === "POST") {
    try {
      const { email, password } = req.body || {};
      if (!email || !password)
        return res.status(400).json({ error: "Email and password required" });

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
      });
      if (!user || !user.active)
        return res.status(401).json({ error: "Invalid credentials" });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid)
        return res.status(401).json({ error: "Invalid credentials" });

      // Password is correct. Recruiters must still clear the emailed code.
      if (needsOtp(user)) {
        if (!user.email) {
          return res.status(403).json({ error: "No email address on your account. Ask your administrator to add one." });
        }
        const code = makeOtp();
        const otpHash = await bcrypt.hash(code, 10);
        const otpExpires = new Date(Date.now() + OTP_MINUTES * 60 * 1000);

        try {
          await sendOtpEmail(user.email, user.name, code, OTP_MINUTES);
        } catch (mailErr) {
          // Delivery failed — refuse the login rather than bypass verification.
          try {
            await prisma.user.update({ where: { id: user.id }, data: { otpHash: null, otpExpires: null, otpAttempts: 0 } });
          } catch (e) {}
          try {
            await prisma.auditLog.create({
              data: { action: "Login OTP Failed", recordName: user.name, detail: "Verification email could not be sent", userId: user.id }
            });
          } catch (e) {}
          return res.status(503).json({
            error: "We could not send your verification code right now. Please try again after some time."
          });
        }

        // Only store the code once the email is actually on its way.
        await prisma.user.update({
          where: { id: user.id },
          data: { otpHash, otpExpires, otpAttempts: 0 }
        });
        try {
          await prisma.auditLog.create({
            data: { action: "Login OTP Sent", recordName: user.name, detail: user.email, userId: user.id }
          });
        } catch (e) {}

        return res.json({
          otpRequired: true,
          email: user.email,
          expiresInMinutes: OTP_MINUTES,
          message: "Verification code sent to your email."
        });
      }

      return res.json(await issueSession(user));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET = Verify token / get current user
  if (req.method === "GET") {
    try {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "No token" });
      const decoded = jwt.verify(token, SECRET);
      return res.json(decoded);
    } catch (err) {
      return res.status(401).json({ error: "Session expired. Please login again." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
