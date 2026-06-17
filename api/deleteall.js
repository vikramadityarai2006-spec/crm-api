const { PrismaClient } = require("@prisma/client");
const prisma = global.prisma || new PrismaClient();
if (!global.prisma) global.prisma = prisma;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Secret key check
  const { secret } = req.query;
  if (secret !== "ampleleap-delete-2024") {
    return res.status(403).json({ error: "Wrong secret key" });
  }

  try {
    // Delete audit logs first (foreign key)
    await prisma.auditLog.deleteMany({});
    // Delete all candidates
    const result = await prisma.candidate.deleteMany({});
    return res.json({ 
      message: `✅ Deleted ${result.count} candidates and all audit logs!`,
      count: result.count 
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
