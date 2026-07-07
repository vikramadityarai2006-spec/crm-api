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

    res.json({total,joined,offered,resPending,thisMonth,nextMonth,statusGroups,clientGroups,months,funnel});
  } catch(err) { res.status(500).json({error:err.message}); }
};
