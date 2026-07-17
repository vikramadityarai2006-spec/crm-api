const { prisma, cors, requireAuth } = require("./_lib");

// Monthly tracking report — supports trailing 1 / 3 / 6 / 12 month windows.
// For recruiters, every query is scoped to their own candidates (ownerName),
// same pattern used in dashboard.js and alerts.js.
module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const ALLOWED = [1, 3, 6, 12];
    let months = parseInt(req.query.months);
    if (!ALLOWED.includes(months)) months = 6;

    const base = { deleted: false };
    if (user.role === "recruiter") {
      base.ownerName = { equals: user.name, mode: "insensitive" };
    }

    // Build `months` trailing calendar-month buckets, oldest first, ending
    // with the current month.
    const now = new Date();
    const buckets = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        label: start.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
        start, end,
      };
    });

    // Added / Offered / Joined all have real date fields we can bucket by
    // month (createdAt, offerMonth, actualDOJ respectively).
    const monthly = await Promise.all(buckets.map(async (b) => {
      const [added, offered, joined] = await Promise.all([
        prisma.candidate.count({ where: { ...base, createdAt: { gte: b.start, lte: b.end } } }),
        prisma.candidate.count({ where: { ...base, offerMonth: { gte: b.start, lte: b.end } } }),
        prisma.candidate.count({ where: { ...base, actualDOJ: { gte: b.start, lte: b.end } } }),
      ]);
      return { label: b.label, added, offered, joined };
    }));

    // Backout / Hold / Resignation-pending are current *statuses*, not
    // date-stamped events — there's no historical log of when a status
    // changed, so these are reported as a current snapshot rather than a
    // monthly trend, to avoid implying false precision.
    const [total, backout, hold, resPending] = await Promise.all([
      prisma.candidate.count({ where: base }),
      prisma.candidate.count({ where: { ...base, joiningStatus: { equals: "Backout", mode: "insensitive" } } }),
      prisma.candidate.count({ where: { ...base, joiningStatus: { equals: "Hold", mode: "insensitive" } } }),
      prisma.candidate.count({ where: { ...base, resignationAcceptance: { equals: "Pending", mode: "insensitive" } } }),
    ]);

    // Breakdowns for candidates added within the selected period (same
    // window as the trend charts above) — these mirror the same fields
    // used as filters/columns on the Candidates page, scoped to this report's range.
    const periodStart = buckets[0].start;
    const periodWhere = { ...base, createdAt: { gte: periodStart, lte: now } };

    const [statusRaw, resignationRaw, clientRaw] = await Promise.all([
      prisma.candidate.groupBy({ by: ["joiningStatus"], where: periodWhere, _count: { _all: true } }),
      prisma.candidate.groupBy({ by: ["resignationAcceptance"], where: periodWhere, _count: { _all: true } }),
      prisma.candidate.groupBy({
        by: ["clientName"],
        where: { ...periodWhere, clientName: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { clientName: "desc" } },
        take: 10,
      }),
    ]);

    const statusBreakdown = statusRaw
      .filter(x => x.joiningStatus)
      .map(x => ({ label: x.joiningStatus, value: x._count._all }))
      .sort((a, b) => b.value - a.value);

    const resignationBreakdown = resignationRaw
      .filter(x => x.resignationAcceptance)
      .map(x => ({ label: x.resignationAcceptance, value: x._count._all }))
      .sort((a, b) => b.value - a.value);

    const clientBreakdown = clientRaw.map(x => ({ label: x.clientName, value: x._count._all }));

    res.json({
      months,
      monthly,
      snapshot: { total, backout, hold, resPending },
      statusBreakdown,
      resignationBreakdown,
      clientBreakdown,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
