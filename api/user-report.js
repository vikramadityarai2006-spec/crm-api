const { prisma, cors, requireAuth } = require("./_lib");

// Per-recruiter performance leaderboard — admin/viewer only. Recruiters get
// their own personal view via /api/reports instead (that one is already
// scoped to `ownerName = their own name`), so this endpoint intentionally
// blocks the "recruiter" role rather than silently scoping it.
module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const user = requireAuth(req, res);
  if (!user) return;
  if (user.role === "recruiter") {
    return res.status(403).json({ error: "Not available for recruiter accounts — use Reports instead." });
  }

  try {
    const base = { deleted: false, ownerName: { not: null } };

    const [totalsByOwner, statusByOwner, resPendingByOwner] = await Promise.all([
      prisma.candidate.groupBy({
        by: ["ownerName"],
        where: base,
        _count: { _all: true },
      }),
      prisma.candidate.groupBy({
        by: ["ownerName", "joiningStatus"],
        where: base,
        _count: { _all: true },
      }),
      prisma.candidate.groupBy({
        by: ["ownerName"],
        where: { ...base, resignationAcceptance: { equals: "Pending", mode: "insensitive" } },
        _count: { _all: true },
      }),
    ]);

    // Pivot joiningStatus rows into { joined, offered, backout, red } per owner
    const STATUS_KEYS = { joined: "Joined", offered: "Offered", backout: "Backout", red: "Red" };
    const byOwner = {};
    for (const row of totalsByOwner) {
      byOwner[row.ownerName] = {
        ownerName: row.ownerName,
        total: row._count._all,
        joined: 0, offered: 0, backout: 0, red: 0, resPending: 0,
      };
    }
    for (const row of statusByOwner) {
      const bucket = byOwner[row.ownerName];
      if (!bucket) continue;
      const status = (row.joiningStatus || "").trim().toLowerCase();
      for (const [key, label] of Object.entries(STATUS_KEYS)) {
        if (status === label.toLowerCase()) bucket[key] += row._count._all;
      }
    }
    for (const row of resPendingByOwner) {
      if (byOwner[row.ownerName]) byOwner[row.ownerName].resPending = row._count._all;
    }

    const recruiters = Object.values(byOwner).map(r => ({
      ...r,
      pipeline: Math.max(r.total - r.joined - r.offered - r.backout - r.red, 0),
      conversionRate: r.total > 0 ? Math.round((r.joined / r.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);

    const totals = recruiters.reduce((acc, r) => ({
      candidates: acc.candidates + r.total,
      offered:    acc.offered + r.offered,
      joined:     acc.joined + r.joined,
      backout:    acc.backout + r.backout,
      red:        acc.red + r.red,
      resPending: acc.resPending + r.resPending,
    }), { candidates: 0, offered: 0, joined: 0, backout: 0, red: 0, resPending: 0 });

    res.json({ recruiters, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
