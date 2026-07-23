const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
// `ready` resolves once the self-migration (otp* columns etc.) has run.
const { ready } = require("./_lib");

const prisma = global.prisma || new PrismaClient();
if (!global.prisma) global.prisma = prisma;
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET environment variable is not set. Refusing to start with an insecure default.");
}

const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
};

const getUser = (req) => {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    return jwt.verify(token, SECRET);
  } catch { return null; }
};

module.exports = async (req, res) => {
  // Some queries here select every User column, so wait for the self-migration.
  await ready;
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const caller = getUser(req);
  if (!caller) return res.status(401).json({ error: "Unauthorized" });
  if (caller.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const id = req.query.id ? parseInt(req.query.id) : null;

  try {
    // ── Single user operations ────────────────────────────────────────
    if (id) {
      if (req.method === "PUT") {
        if (id === caller.id && req.body.active === false)
          return res.status(400).json({ error: "You cannot deactivate your own account" });
        const data = {};
        if (req.body.name !== undefined) data.name = String(req.body.name).trim();
        if (req.body.email !== undefined) {
          const newEmail = String(req.body.email).toLowerCase().trim();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail))
            return res.status(400).json({ error: "Enter a valid email address" });
          const clash = await prisma.user.findUnique({ where: { email: newEmail } });
          if (clash && clash.id !== id)
            return res.status(400).json({ error: "Another user already uses that email" });
          data.email = newEmail;
        }
        if (req.body.role !== undefined) data.role = req.body.role;
        if (req.body.active !== undefined) data.active = req.body.active;
        if (req.body.password) {
          if (req.body.password.length < 6)
            return res.status(400).json({ error: "Password must be at least 6 characters" });
          data.password = await bcrypt.hash(req.body.password, 10);
        }
        // Access is matched on NAME, so renaming a user without renaming their
        // candidates' ownerName would silently cut them off from every record
        // they own. Carry the rename across before updating the account.
        const before = await prisma.user.findUnique({ where: { id }, select: { name: true } });
        let carried = 0;
        if (data.name && before && data.name !== before.name) {
          try {
            const moved = await prisma.candidate.updateMany({
              where: { ownerName: { equals: before.name, mode: "insensitive" } },
              data: { ownerName: data.name },
            });
            carried = moved.count;
            // Keep the owners dropdown in step with the new name.
            await prisma.masterData.updateMany({
              where: { category: "owners", value: before.name },
              data: { value: data.name },
            });
          } catch (e) { /* non-fatal */ }
        }

        const u = await prisma.user.update({
          where: { id }, data,
          select: { id:true, name:true, email:true, role:true, active:true }
        });
        try {
          const changes = Object.keys(data).map(k => k === "password" ? "password reset" : `${k}=${data[k]}`).join(", ")
            + (carried ? ` · ${carried} candidate(s) re-linked` : "");
          await prisma.auditLog.create({ data: { action: "User Updated", recordName: u.name, detail: changes || "updated", userId: caller.id } });
        } catch (e) { /* ignore audit failure */ }
        return res.json(u);
      }

      if (req.method === "DELETE") {
        if (id === caller.id)
          return res.status(400).json({ error: "You cannot delete your own account" });
        // HARD DELETE — permanently removes from database
        const target = await prisma.user.findUnique({ where: { id }, select: { name: true } });
        try {
          // First nullify audit log references to avoid FK constraint errors
          await prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
          await prisma.candidate.updateMany({ where: { createdById: id }, data: { createdById: null } });
          // Now hard delete the user
          await prisma.user.delete({ where: { id } });
          try { await prisma.auditLog.create({ data: { action: "User Deleted", recordName: target?.name || `#${id}`, detail: "Permanently removed from team", userId: caller.id } }); } catch (e) {}
          return res.json({ message: "User permanently deleted", id });
        } catch (delErr) {
          // Fallback: if hard delete fails (e.g. other FK), just deactivate
          await prisma.user.update({ where: { id }, data: { active: false } });
          try { await prisma.auditLog.create({ data: { action: "User Deactivated", recordName: target?.name || `#${id}`, detail: "Hard delete failed — deactivated instead", userId: caller.id } }); } catch (e) {}
          return res.json({ message: "User deactivated", id, note: "Hard delete failed, user deactivated instead" });
        }
      }
    }

    // ── List all users (active and disabled) ─────────────────────────
    if (req.method === "GET") {
      const users = await prisma.user.findMany({
        // Return inactive users too — the admin UI has an "Enable Account"
        // action, and filtering them out here made disabled users permanently
        // invisible and impossible to re-enable.
        select: { id:true, name:true, email:true, role:true, active:true, createdAt:true },
        orderBy: { createdAt: "asc" }
      });
      return res.json(users);
    }

    // ── Create new user ──────────────────────────────────────────────
    if (req.method === "POST") {
      const { name, email, password, role } = req.body;
      if (!name || !email || !password)
        return res.status(400).json({ error: "Name, email and password required" });
      if (password.length < 6)
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (existing)
        return res.status(400).json({ error: "A user with this email already exists" });
      const hashed = await bcrypt.hash(password, 10);
      const u = await prisma.user.create({
        data: { name, email: email.toLowerCase().trim(), password: hashed, role: role || "recruiter" },
        select: { id:true, name:true, email:true, role:true, active:true }
      });
      // Ownership is matched on name, so a new user must also exist in the
      // "owners" master list — otherwise candidates cannot be assigned to
      // them and their dashboard stays permanently empty.
      try {
        await prisma.masterData.upsert({
          where: { category_value: { category: "owners", value: u.name } },
          update: { active: true },
          create: { category: "owners", value: u.name },
        });
      } catch (e) { /* non-fatal */ }

      try { await prisma.auditLog.create({ data: { action: "User Created", recordName: u.name, detail: `${u.email} · Role: ${u.role}`, userId: caller.id } }); } catch (e) { /* ignore audit failure */ }
      return res.json(u);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ error: "Email already in use" });
    res.status(500).json({ error: err.message });
  }
};
