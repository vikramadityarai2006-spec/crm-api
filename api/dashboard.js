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

    // Trailing-window boundaries for the Total Candidates 3M/6M/12M/All card
    const d3 = new Date(now);  d3.setMonth(d3.getMonth() - 3);
    const d6 = new Date(now);  d6.setMonth(d6.getMonth() - 6);
    const d12 = new Date(now); d12.setMonth(d12.getMonth() - 12);

    const [total,joined,offered,resPending,thisMonth,nextMonth,statusGroups,clientGroups,backout,hold] = await Promise.all([
      prisma.candidate.count({where:base}),
      prisma.candidate.count({where:{...base,joiningStatus:{equals:"Joined",mode:"insensitive"}}}),
      prisma.candidate.count({where:{...base,joiningStatus:{equals:"Offered",mode:"insensitive"}}}),
      prisma.candidate.count({where:{...base,resignationAcceptance:{equals:"Pending",mode:"insensitive"}}}),
      prisma.candidate.count({where:{...base,actualDOJ:{gte:sm,lte:em}}}),
      prisma.candidate.count({where:{...base,proposedDOJ:{gte:sn,lte:en}}}),
      prisma.candidate.groupBy({by:["joiningStatus"],where:base,_count:{_all:true}}),
      prisma.candidate.groupBy({by:["clientName"],where:base,_count:{_all:true},orderBy:{_count:{clientName:"desc"}},take:10}),
      prisma.candidate.count({where:{...base,joiningStatus:{equals:"Backout",mode:"insensitive"}}}),
      prisma.candidate.count({where:{...base,joiningStatus:{equals:"Hold",mode:"insensitive"}}}),
    ]);

    // Total Candidates breakdown for the Dashboard KPI card
    const [last3, last6, last12] = await Promise.all([
      prisma.candidate.count({ where: { ...base, createdAt: { gte: d3 } } }),
      prisma.candidate.count({ where: { ...base, createdAt: { gte: d6 } } }),
      prisma.candidate.count({ where: { ...base, createdAt: { gte: d12 } } }),
    ]);

    // Per-company status breakdown (Pipeline / Red / Backout / Joined / Offered),
    // synced live from the same candidate data as everything else on the
    // dashboard. Grouped by client + joiningStatus, then pivoted below.
    const clientStatusRaw = await prisma.candidate.groupBy({
      by: ["clientName", "joiningStatus"],
      where: { ...base, clientName: { not: null } },
      _count: { _all: true },
    });
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
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Conversion funnel: Total candidates -> Offered -> Joined
    const funnel = {
      total,
      offered,
      joined,
      backout,
      hold,
      conversionRate: offered > 0 ? Math.round((joined / offered) * 100) : 0,
      offerRate: total > 0 ? Math.round((offered / total) * 100) : 0,
    };

    const months = await Promise.all(Array.from({length:6},(_,i)=>{
      const d=new Date(); d.setMonth(d.getMonth()-(5-i));
      const s=new Date(d.getFullYear(),d.getMonth(),1), e=new Date(d.getFullYear(),d.getMonth()+1,0);
      return prisma.candidate.count({where:{...base,actualDOJ:{gte:s,lte:e}}}).then(v=>({label:s.toLocaleString("en-IN",{month:"short",year:"2-digit"}),value:v}));
    }));

    res.json({total,joined,offered,resPending,thisMonth,nextMonth,statusGroups,clientGroups,months,funnel,
      candidatesByPeriod: { last3, last6, last12, total },
      clientStatusBreakdown,
    });
  } catch(err) { res.status(500).json({error:err.message}); }
};
