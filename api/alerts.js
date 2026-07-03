const { prisma, cors, requireAuth } = require("./_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [expiringAgreements, upcomingDOJ, pendingResignations] = await Promise.all([
      // Agreements expiring within 30 days (or already expired, not yet renewed)
      prisma.company.findMany({
        where: {
          active: true,
          agreementEndDate: { not: null, lte: in30 },
        },
        select: { id: true, companyName: true, contactName: true, email: true, mobile: true, agreementEndDate: true, agreementStartDate: true },
        orderBy: { agreementEndDate: "asc" },
      }),
      // Candidates with proposed DOJ within next 7 days, not yet joined
      prisma.candidate.findMany({
        where: {
          deleted: false,
          proposedDOJ: { not: null, gte: now, lte: in7 },
          actualDOJ: null,
        },
        select: { id: true, candidateName: true, clientName: true, phone: true, proposedDOJ: true, ownerName: true, joiningStatus: true },
        orderBy: { proposedDOJ: "asc" },
        take: 20,
      }),
      // Pending resignation acceptances
      prisma.candidate.findMany({
        where: {
          deleted: false,
          resignationAcceptance: { equals: "Pending", mode: "insensitive" },
        },
        select: { id: true, candidateName: true, clientName: true, phone: true, ownerName: true, proposedDOJ: true },
        orderBy: { id: "desc" },
        take: 20,
      }),
    ]);

    const formatted = expiringAgreements.map(c => ({
      ...c,
      daysLeft: Math.ceil((new Date(c.agreementEndDate) - now) / (1000 * 60 * 60 * 24)),
      isExpired: new Date(c.agreementEndDate) < now,
    }));

    const dojFormatted = upcomingDOJ.map(c => ({
      ...c,
      daysLeft: Math.ceil((new Date(c.proposedDOJ) - now) / (1000 * 60 * 60 * 24)),
    }));

    res.json({
      expiringAgreements: formatted,
      upcomingDOJ: dojFormatted,
      pendingResignations,
      totalAlerts: formatted.length + dojFormatted.length + pendingResignations.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
