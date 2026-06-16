const { prisma, cors, requireAuth, requireAdmin } = require("../_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === "GET") {
      const [all, codes] = await Promise.all([
        prisma.masterData.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
        prisma.statusCode.findMany({ where: { active: true } }),
      ]);
      const grouped = {};
      for (const item of all) {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item.value);
      }
      return res.json({ ...grouped, statusCodes: codes });
    }

    if (req.method === "POST") {
      if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });
      const { category, value } = req.body;
      const item = await prisma.masterData.upsert({
        where: { category_value: { category, value } },
        update: { active: true },
        create: { category, value },
      });
      return res.json(item);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
