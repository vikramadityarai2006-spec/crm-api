const { prisma, cors, requireAuth } = require("../_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfNext  = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNext    = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const base = { deleted: false };

    const [total, joined, offered, resPending, thisMonth, nextMonth, statusGroups, clientGroups] = await Promise.all([
      prisma.candidate.count({ where: base }),
      prisma.candidate.count({ where: { ...base, joiningStatus: { in: ["Joined", "joined"] } } }),
      prisma.candidate.count({ where: { ...base, joiningStatus: { in: ["Offered", "offered"] } } }),
      prisma.candidate.count({ where: { ...base, resignationAcceptance: { in: ["Pending", "pending"] } } }),
      prisma.candidate.count({ where: { ...base, actualDOJ: { gte: startOfMonth, lte: endOfMonth } } }),
      prisma.candidate.count({ where: { ...base, proposedDOJ: { gte: startOfNext, lte: endOfNext } } }),
      prisma.candidate.groupBy({ by: ["joiningStatus"], where: base, _count: true }),
      prisma.candidate.groupBy({ by: ["clientName"], where: base, _count: true, orderBy: { _count: { clientName: "desc" } }, take: 10 }),
    ]);

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const count = await prisma.candidate.count({ where: { ...base, actualDOJ: { gte: start, lte: end } } });
      months.push({ label: start.toLocaleString("en-IN", { month: "short", year: "2-digit" }), value: count });
    }

    res.json({ total, joined, offered, resPending, thisMonth, nextMonth, statusGroups, clientGroups, months });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
