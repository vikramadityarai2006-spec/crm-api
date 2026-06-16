const { prisma, cors, requireAuth, toDate } = require("../../_lib");

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

  const id = parseInt(req.query.id);
  if (!id) return res.status(400).json({ error: "ID required" });

  try {
    if (req.method === "GET") {
      const c = await prisma.candidate.findUnique({ where: { id } });
      if (!c || c.deleted) return res.status(404).json({ error: "Not found" });
      return res.json(c);
    }

    if (req.method === "PUT") {
      if (!["admin", "recruiter"].includes(user.role))
        return res.status(403).json({ error: "Not allowed" });
      const c = await prisma.candidate.update({ where: { id }, data: buildData(req.body) });
      await prisma.auditLog.create({
        data: { action: "Updated", recordName: c.candidateName, detail: `Status: ${c.joiningStatus}`, userId: user.id, candidateId: id }
      });
      return res.json(c);
    }

    if (req.method === "DELETE") {
      if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });
      const c = await prisma.candidate.update({ where: { id }, data: { deleted: true } });
      await prisma.auditLog.create({
        data: { action: "Deleted", recordName: c.candidateName, detail: "Soft deleted", userId: user.id, candidateId: id }
      });
      return res.json({ message: "Deleted" });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
