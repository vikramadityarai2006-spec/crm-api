const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = global.prisma || new PrismaClient();
if (!global.prisma) global.prisma = prisma;

const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
};

const auth = (req) => {
  try {
    const jwt = require("jsonwebtoken");
    const SECRET = process.env.JWT_SECRET || "ampleleap-crm-super-secret-key-2024";
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    return jwt.verify(token, SECRET);
  } catch { return null; }
};

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = auth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const id = req.query.id ? parseInt(req.query.id) : null;

  try {
    // ── Single user operations ──────────────────────────────────────────────
    if (id) {
      // GET single user
      if (req.method === "GET") {
        const u = await prisma.user.findUnique({
          where: { id },
          select: { id:true, name:true, email:true, role:true, active:true, createdAt:true }
        });
        if (!u) return res.status(404).json({ error: "User not found" });
        return res.json(u);
      }

      // PUT - update name, role, active status, password
      if (req.method === "PUT") {
        // Prevent admin from deactivating themselves
        if (id === user.id && req.body.active === false)
          return res.status(400).json({ error: "You cannot deactivate your own account" });

        const data = {};
        if (req.body.name !== undefined) data.name = req.body.name;
        if (req.body.role !== undefined) data.role = req.body.role;
        if (req.body.active !== undefined) data.active = req.body.active;
        if (req.body.password) {
          if (req.body.password.length < 6)
            return res.status(400).json({ error: "Password must be at least 6 characters" });
          data.password = await bcrypt.hash(req.body.password, 10);
        }

        const u = await prisma.user.update({
          where: { id },
          data,
          select: { id:true, name:true, email:true, role:true, active:true }
        });
        return res.json(u);
      }

      // DELETE - permanently delete user (not allowed on self)
      if (req.method === "DELETE") {
        if (id === user.id)
          return res.status(400).json({ error: "You cannot delete your own account" });

        // Soft-delete by deactivating, or hard delete if requested
        const hard = req.query.hard === "1";
        if (hard) {
          await prisma.user.delete({ where: { id } });
        } else {
          await prisma.user.update({ where: { id }, data: { active: false } });
        }
        return res.json({ message: hard ? "User permanently deleted" : "User deactivated" });
      }
    }

    // ── List all users ──────────────────────────────────────────────────────
    if (req.method === "GET") {
      const users = await prisma.user.findMany({
        select: { id:true, name:true, email:true, role:true, active:true, createdAt:true },
        orderBy: { createdAt: "asc" }
      });
      return res.json(users);
    }

    // ── Create new user ─────────────────────────────────────────────────────
    if (req.method === "POST") {
      const { name, email, password, role } = req.body;
      if (!name || !email || !password)
        return res.status(400).json({ error: "Name, email and password are required" });
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
      return res.json(u);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ error: "Email already in use" });
    res.status(500).json({ error: err.message });
  }
};
