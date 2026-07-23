const { prisma, cors, requireAuth, toDate } = require("./_lib");

const build = (b) => ({
  clientName: (b.clientName||b.client) ? String(b.clientName||b.client).trim() : null,
  designation: b.designation||null,
  location: b.location||null,
  candidateName: String(b.candidateName||b.name||"").trim(),
  actualDOJ: toDate(b.actualDOJ),
  offerMonth: toDate(b.offerMonth),
  phone: b.phone?String(b.phone):null,
  email: b.email?String(b.email).trim().toLowerCase():null,
  resignationAcceptance: b.resignationAcceptance||null,
  proposedDOJ: toDate(b.proposedDOJ),
  ownerName: (b.ownerName||b.owner) ? String(b.ownerName||b.owner).trim() : null,
  joiningStatus: b.joiningStatus||null,
  ctcPerMonth: (b.ctcPerMonth||b.ctc)?parseFloat(b.ctcPerMonth||b.ctc):null,
  statusCode: b.statusCode||null,
  notes: b.notes||null,
});

// Parse comma-separated multi values
const multi = (v) => v ? v.split(",").map(x=>x.trim()).filter(Boolean) : [];

// A recruiter may only see/manage candidates whose Owner field matches their
// own account name. Admins (and viewers, who are read-only anyway) are unrestricted.
const isOwnRecord = (candidate, user) =>
  user.role !== "recruiter" ||
  (candidate.ownerName || "").trim().toLowerCase() === (user.name || "").trim().toLowerCase();

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
        if (!isOwnRecord(c, user)) return res.status(403).json({ error:"You can only view your own candidates" });
        return res.json(c);
      }
      if (req.method === "PUT") {
        if (!["admin","recruiter"].includes(user.role)) return res.status(403).json({ error:"Not allowed" });
        const existing = await prisma.candidate.findUnique({ where:{id} });
        if (!existing || existing.deleted) return res.status(404).json({ error:"Not found" });
        if (!isOwnRecord(existing, user)) return res.status(403).json({ error:"You can only update your own candidates" });
        const data = build(req.body);
        if (user.role === "recruiter") data.ownerName = user.name; // recruiters can't reassign ownership away from themselves
        const c = await prisma.candidate.update({ where:{id}, data });
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

    // LIST with full filter support
    if (req.method === "GET") {
      const {
        search, client, owner, status, statusCode, location,
        designation, resignation,
        offerFrom, offerTo, proposedFrom, proposedTo, actualFrom, actualTo,
        page=1, limit=20, sortDir="asc"
      } = req.query;

      const where = { deleted:false };

      // Search
      if (search) where.OR = [
        {candidateName:{contains:search,mode:"insensitive"}},
        {clientName:{contains:search,mode:"insensitive"}},
        {designation:{contains:search,mode:"insensitive"}},
        {phone:{contains:search,mode:"insensitive"}},
        {ownerName:{contains:search,mode:"insensitive"}},
      ];

      // Multi-select filters (comma separated)
      const clients = multi(client);
      const owners = multi(owner);
      const statuses = multi(status);
      const codes = multi(statusCode);
      const resignations = multi(resignation);

      if (clients.length === 1) where.clientName = {contains:clients[0],mode:"insensitive"};
      else if (clients.length > 1) where.clientName = {in:clients};

      if (owners.length === 1) where.ownerName = {contains:owners[0],mode:"insensitive"};
      else if (owners.length > 1) where.ownerName = {in:owners};

      if (statuses.length === 1) where.joiningStatus = {contains:statuses[0],mode:"insensitive"};
      else if (statuses.length > 1) where.joiningStatus = {in:statuses};

      if (codes.length === 1) where.statusCode = codes[0];
      else if (codes.length > 1) where.statusCode = {in:codes};

      if (resignations.length === 1) where.resignationAcceptance = {contains:resignations[0],mode:"insensitive"};
      else if (resignations.length > 1) where.resignationAcceptance = {in:resignations};

      if (location) where.location = {contains:location,mode:"insensitive"};
      if (designation) where.designation = {contains:designation,mode:"insensitive"};

      // Date range filters
      if (offerFrom || offerTo) {
        where.offerMonth = {};
        if (offerFrom) where.offerMonth.gte = new Date(offerFrom);
        if (offerTo) where.offerMonth.lte = new Date(offerTo);
      }
      if (proposedFrom || proposedTo) {
        where.proposedDOJ = {};
        if (proposedFrom) where.proposedDOJ.gte = new Date(proposedFrom);
        if (proposedTo) where.proposedDOJ.lte = new Date(proposedTo);
      }
      if (actualFrom || actualTo) {
        where.actualDOJ = {};
        if (actualFrom) where.actualDOJ.gte = new Date(actualFrom);
        if (actualTo) where.actualDOJ.lte = new Date(actualTo);
      }

      // Recruiters only ever see their own candidates — this always wins,
      // regardless of any owner filter the client tried to send.
      if (user.role === "recruiter") {
        where.ownerName = { equals: user.name, mode: "insensitive" };
      }

      const skip = (parseInt(page)-1)*parseInt(limit);
      // Sort by ID — asc (default) = oldest first, desc = newest first
      const dir = sortDir === "desc" ? "desc" : "asc";
      const [total, candidates] = await Promise.all([
        prisma.candidate.count({where}),
        prisma.candidate.findMany({where, orderBy:{id:dir}, skip, take:parseInt(limit)}),
      ]);
      return res.json({candidates, total, page:parseInt(page), pages:Math.ceil(total/parseInt(limit))});
    }

    // Create
    if (req.method === "POST") {
      if (!["admin","recruiter"].includes(user.role)) return res.status(403).json({ error:"Not allowed" });
      const data = build(req.body);
      if (user.role === "recruiter") data.ownerName = user.name; // new candidates always belong to whoever created them
      const c = await prisma.candidate.create({ data:{...data,createdById:user.id} });
      await prisma.auditLog.create({ data:{action:"Created",recordName:c.candidateName,detail:`Client: ${c.clientName}`,userId:user.id,candidateId:c.id} });
      return res.status(201).json(c);
    }

    res.status(405).json({ error:"Method not allowed" });
  } catch(err) { res.status(500).json({ error:err.message }); }
};
