const { prisma, cors, requireAuth } = require("../_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true, role: true }
    });
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
