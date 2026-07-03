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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // POST = Login
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

      const expiresIn = SESSION_HOURS * 3600;
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role },
        SECRET,
        { expiresIn }
      );

      return res.json({
        token,
        expiresIn,
        sessionHours: SESSION_HOURS,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
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
