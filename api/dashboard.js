const { prisma, cors, requireAuth } = require("./_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const now = new Date();
    const sm = new Date(now.getFullYear(),now.getMonth(),1);
    const em = new Date(now.getFullYear(),now.getMonth()+1,0);
    const sn = new Date(now.getFullYear(),now.getMonth()+1,1);
    const en = new Date(now.getFullYear(),now.getMonth()+2,0);
    const base = {deleted:false};
    // Recruiters get a personal view scoped to candidates they own — every
    // query below uses `base`, so this one line scopes the whole dashboard.
    if (user.role === "recruiter") base.ownerName = { equals: user.name, mode: "insensitive" };

    // Optional date-range filter (From–To). When provided, the WHOLE dashboard
    // reflects only candidates whose OFFER MONTH falls within the selected
    // window. Empty from/to = all-time (unchanged behaviour).
    // NOTE: candidates with no offerMonth set are excluded once a range is
    // applied, since they cannot be placed on the offer timeline.
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) { const f = new Date(from); if (!isNaN(f)) dateFilter.gte = f; }
    if (to)   { const t = new Date(to);   if (!isNaN(t)) { t.setHours(23,59,59,999); dateFilter.lte = t; } }
    if (Object.keys(dateFilter).length) base.offerMonth = dateFilter;

    // PERFORMANCE: this endpoint used to fire 17 queries across 3 sequential
    // waves. Several were redundant — the joined/offered/backout/hold counts
    // repeat what the joiningStatus groupBy already returns, and clientGroups
    // repeats the client breakdown. Everything below is now derived from 6
    // queries issued in a SINGLE parallel wave.
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [total, resPending, nextMonth, statusGroups, clientStatusRaw, dojRows] = await Promise.all([
      prisma.candidate.count({ where: base }),
      prisma.candidate.count({ where: { ...base, resignationAcceptance: { equals: "Pending", mode: "insensitive" } } }),
      prisma.candidate.count({ where: { ...base, proposedDOJ: { gte: sn, lte: en } } }),
      prisma.candidate.groupBy({ by: ["joiningStatus"], where: base, _count: { _all: true } }),
      prisma.candidate.groupBy({
        by: ["clientName", "joiningStatus"],
        where: { ...base, clientName: { not: null } },
        _count: { _all: true },
      }),
      // One row-set of joining dates covers both the 6-month chart and the
      // "joining this month" figure, replacing 7 separate count queries.
      prisma.candidate.findMany({
        where: { ...base, actualDOJ: { gte: sixMonthsAgo, lte: em } },
        select: { actualDOJ: true },
      }),
    ]);

    // ── Status counts derived from the groupBy (no extra queries) ──────────
    const statusTally = {};
    for (const g of statusGroups) {
      statusTally[(g.joiningStatus || "").trim().toLowerCase()] = (statusTally[(g.joiningStatus || "").trim().toLowerCase()] || 0) + g._count._all;
    }
    const joined  = statusTally["joined"]  || 0;
    const offered = statusTally["offered"] || 0;
    const backout = statusTally["backout"] || 0;
    const hold    = statusTally["hold"]    || 0;

    // ── Monthly volume + this-month count, bucketed in memory ─────────────
    const monthBuckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }), value: 0 };
    });
    const bucketIndex = Object.fromEntries(monthBuckets.map((b, i) => [b.key, i]));
    let thisMonth = 0;
    const thisKey = `${now.getFullYear()}-${now.getMonth()}`;
    for (const r of dojRows) {
      if (!r.actualDOJ) continue;
      const d = new Date(r.actualDOJ);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const idx = bucketIndex[k];
      if (idx !== undefined) monthBuckets[idx].value++;
      if (k === thisKey) thisMonth++;
    }
    const months = monthBuckets.map(({ label, value }) => ({ label, value }));

    const last3 = total, last6 = total, last12 = total;

    // ── Per-company breakdown, pivoted from the single groupBy ────────────
    const clientStatusMap = {};
    for (const g of clientStatusRaw) {
      const name = g.clientName;
      if (!clientStatusMap[name]) {
        clientStatusMap[name] = { clientName: name, total: 0, joined: 0, offered: 0, backout: 0, red: 0 };
      }
      const count = g._count._all;
      clientStatusMap[name].total += count;
      const st = (g.joiningStatus || "").trim().toLowerCase();
      if (st === "joined") clientStatusMap[name].joined += count;
      else if (st === "offered") clientStatusMap[name].offered += count;
      else if (st === "backout") clientStatusMap[name].backout += count;
      else if (st === "red") clientStatusMap[name].red += count;
    }
    const clientStatusBreakdown = Object.values(clientStatusMap)
      .map(c => ({ ...c, pipeline: c.total - c.joined - c.offered - c.backout - c.red }))
      .sort((a, b) => b.total - a.total);

    // clientGroups kept for backwards compatibility — derived, not queried.
    const clientGroups = clientStatusBreakdown.map(c => ({ clientName: c.clientName, _count: { _all: c.total } }));

    const funnel = {
      total, offered, joined, backout, hold,
      conversionRate: offered > 0 ? Math.round((joined / offered) * 100) : 0,
      offerRate: total > 0 ? Math.round((offered / total) * 100) : 0,
    };

    res.json({total,joined,offered,resPending,thisMonth,nextMonth,statusGroups,clientGroups,months,funnel,
      candidatesByPeriod: { last3, last6, last12, total },
      clientStatusBreakdown,
    });
  } catch(err) { res.status(500).json({error:err.message}); }
};
