const { prisma, cors, requireAuth, toDate } = require("./_lib");

const build = (b) => ({
  clientName:b.clientName||b.client||null, designation:b.designation||null,
  location:b.location||null, candidateName:b.candidateName||b.name||"",
  actualDOJ:toDate(b.actualDOJ), offerMonth:toDate(b.offerMonth),
  phone:b.phone?String(b.phone):null, resignationAcceptance:b.resignationAcceptance||null,
  proposedDOJ:toDate(b.proposedDOJ), ownerName:b.ownerName||b.owner||null,
  joiningStatus:b.joiningStatus||null,
  ctcPerMonth:(b.ctcPerMonth||b.ctc)?parseFloat(b.ctcPerMonth||b.ctc):null,
  statusCode:b.statusCode||null, notes:b.notes||null,
});

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const user = requireAuth(req, res);
  if (!user) return;

  const id = req.query.id ? parseInt(req.query.id) : null;
  const isDelete = req.query.delete === "1";

  try {
    // POST delete
    if (req.method === "POST" && isDelete) {
      if (user.role !== "admin") return res.status(403).json({ error:"Admin only" });
      const { id: delId } = req.body;
      const c = await prisma.candidate.update({ where:{id:parseInt(delId)}, data:{deleted:true} });
      await prisma.auditLog.create({ data:{action:"Deleted",recordName:c.candidateName,detail:"Soft deleted",userId:user.id,candidateId:parseInt(delId)} });
      return res.json({ message:"Deleted successfully" });
    }

    // Single record
    if (id) {
      if (req.method === "GET") {
        const c = await prisma.candidate.findUnique({ where:{id} });
        if (!c||c.deleted) return res.status(404).json({ error:"Not found" });
        return res.json(c);
      }
      if (req.method === "PUT") {
        if (!["admin","recruiter"].includes(user.role)) return res.status(403).json({ error:"Not allowed" });
        const c = await prisma.candidate.update({ where:{id}, data:build(req.body) });
        await prisma.auditLog.create({ data:{action:"Updated",recordName:c.candidateName,detail:`Status: ${c.joiningStatus}`,userId:user.id,candidateId:id} });
        return res.json(c);
      }
      if (req.method === "DELETE") {
        if (user.role !== "admin") return res.status(403).json({ error:"Admin only" });
        const c = await prisma.candidate.update({ where:{id}, data:{deleted:true} });
        await prisma.auditLog.create({ data:{action:"Deleted",recordName:c.candidateName,detail:"Soft deleted",userId:user.id,candidateId:id} });
        return res.json({ message:"Deleted" });
      }
    }

    // List
    if (req.method === "GET") {
      const { search,client,owner,status,statusCode,location,page=1,limit=20 } = req.query;
      const where = { deleted:false };
      if (search) where.OR = [
        {candidateName:{contains:search,mode:"insensitive"}},
        {clientName:{contains:search,mode:"insensitive"}},
        {designation:{contains:search,mode:"insensitive"}},
        {phone:{contains:search,mode:"insensitive"}},
        {ownerName:{contains:search,mode:"insensitive"}},
      ];
      if (client) where.clientName={contains:client,mode:"insensitive"};
      if (owner) where.ownerName={contains:owner,mode:"insensitive"};
      if (status) where.joiningStatus={contains:status,mode:"insensitive"};
      if (statusCode) where.statusCode=statusCode;
      if (location) where.location={contains:location,mode:"insensitive"};
      const skip=(parseInt(page)-1)*parseInt(limit);
      const [total,candidates] = await Promise.all([
        prisma.candidate.count({where}),
        prisma.candidate.findMany({where,orderBy:{id:"desc"},skip,take:parseInt(limit)}),
      ]);
      return res.json({candidates,total,page:parseInt(page),pages:Math.ceil(total/parseInt(limit))});
    }

    // Create
    if (req.method === "POST") {
      if (!["admin","recruiter"].includes(user.role)) return res.status(403).json({ error:"Not allowed" });
      const c = await prisma.candidate.create({ data:{...build(req.body),createdById:user.id} });
      await prisma.auditLog.create({ data:{action:"Created",recordName:c.candidateName,detail:`Client: ${c.clientName}`,userId:user.id,candidateId:c.id} });
      return res.status(201).json(c);
    }

    res.status(405).json({ error:"Method not allowed" });
  } catch(err) { res.status(500).json({ error:err.message }); }
};
