const { prisma, cors, requireAuth } = require("../_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true } } },
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
