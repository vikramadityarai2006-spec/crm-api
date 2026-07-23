const { prisma, cors, requireAuth } = require("./_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const user = requireAuth(req, res);
  if (!user) return;
  // SECURITY: the audit trail exposes every login, every candidate change
  // across all recruiters, and user/company activity. The UI hides this page
  // from non-admins, but that is cosmetic — enforce it on the server too.
  if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  try {
    const logs = await prisma.auditLog.findMany({
      orderBy:{createdAt:"desc"}, take:100,
      include:{user:{select:{name:true}}},
    });
    res.json(logs);
  } catch(err) { res.status(500).json({error:err.message}); }
};
