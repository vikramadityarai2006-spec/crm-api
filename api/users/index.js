const bcrypt = require("bcryptjs");
const { prisma, cors, requireAuth } = require("../_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;
  if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  try {
    if (req.method === "GET") {
      const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }
      });
      return res.json(users);
    }

    if (req.method === "POST") {
      const { name, email, password, role } = req.body;
      const hashed = await bcrypt.hash(password, 10);
      const u = await prisma.user.create({ data: { name, email, password: hashed, role } });
      return res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
