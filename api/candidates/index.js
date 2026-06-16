const { prisma, cors, requireAuth, toDate } = require("../_lib");

const buildData = (body) => ({
  clientName:            body.clientName || body.client || null,
  designation:           body.designation || null,
  location:              body.location || null,
  candidateName:         body.candidateName || body.name || "",
  actualDOJ:             toDate(body.actualDOJ),
  offerMonth:            toDate(body.offerMonth),
  phone:                 body.phone ? String(body.phone) : null,
  resignationAcceptance: body.resignationAcceptance || null,
  proposedDOJ:           toDate(body.proposedDOJ),
  ownerName:             body.ownerName || body.owner || null,
  joiningStatus:         body.joiningStatus || null,
  ctcPerMonth:           body.ctcPerMonth || body.ctc ? parseFloat(body.ctcPerMonth || body.ctc) : null,
  statusCode:            body.statusCode || null,
  notes:                 body.notes || null,
});

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === "GET") {
      const { search, client, owner, status, statusCode, location, page = 1, limit = 20 } = req.query;
      const where = { deleted: false };

      if (search) {
        where.OR = [
          { candidateName: { contains: search, mode: "insensitive" } },
          { clientName:    { contains: search, mode: "insensitive" } },
          { designation:   { contains: search, mode: "insensitive" } },
          { phone:         { contains: search, mode: "insensitive" } },
          { ownerName:     { contains: search, mode: "insensitive" } },
        ];
      }
      if (client)     where.clientName    = { contains: client,     mode: "insensitive" };
      if (owner)      where.ownerName     = { contains: owner,      mode: "insensitive" };
      if (status)     where.joiningStatus = { contains: status,     mode: "insensitive" };
      if (statusCode) where.statusCode    = statusCode;
      if (location)   where.location      = { contains: location,   mode: "insensitive" };

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [total, candidates] = await Promise.all([
        prisma.candidate.count({ where }),
        prisma.candidate.findMany({ where, orderBy: { id: "desc" }, skip, take: parseInt(limit) }),
      ]);

      return res.json({ candidates, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    }

    if (req.method === "POST") {
      if (!["admin", "recruiter"].includes(user.role))
        return res.status(403).json({ error: "Not allowed" });

      const candidate = await prisma.candidate.create({
        data: { ...buildData(req.body), createdById: user.id }
      });
      await prisma.auditLog.create({
        data: { action: "Created", recordName: candidate.candidateName, detail: `Client: ${candidate.clientName}`, userId: user.id, candidateId: candidate.id }
      });
      return res.status(201).json(candidate);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
