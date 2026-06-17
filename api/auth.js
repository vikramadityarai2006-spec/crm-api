const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = global.prisma || new PrismaClient();
if (!global.prisma) global.prisma = prisma;
const SECRET = process.env.JWT_SECRET || "ampleleap-crm-super-secret-key-2024";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "POST") {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (!user || !user.active) return res.status(401).json({ error: "Invalid credentials" });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role },
        SECRET,
        { expiresIn: "7d" }
      );
      return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      console.error("Login error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "GET") {
    try {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "No token" });
      const decoded = jwt.verify(token, SECRET);
      return res.json(decoded);
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  }

  return res.status(200).json({ status: "ok", endpoint: "auth" });
};
