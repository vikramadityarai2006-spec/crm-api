const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");

let prisma;
if (!global.prisma) {
  global.prisma = new PrismaClient();
}
prisma = global.prisma;

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET environment variable is not set. Refusing to start with an insecure default.");
}

const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
};

const getUser = (req) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.replace("Bearer ", "");
    if (!token) return null;
    return jwt.verify(token, SECRET);
  } catch { return null; }
};

const requireAuth = (req, res) => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return user;
};

const toDate = (v) => {
  if (!v || v === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// Auto-create Company table if it doesn't exist
const ensureCompanyTable = async () => {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Company" (
        "id" SERIAL PRIMARY KEY,
        "companyName" TEXT NOT NULL,
        "spoc" TEXT,
        "contactName" TEXT,
        "department" TEXT,
        "mobile" TEXT,
        "email" TEXT,
        "address" TEXT,
        "dsc" TEXT NOT NULL DEFAULT 'NO',
        "hardcopy" TEXT NOT NULL DEFAULT 'NO',
        "serviceFee" TEXT,
        "agreementUrl" TEXT,
        "agreementStartDate" TIMESTAMP(3),
        "agreementEndDate" TIMESTAMP(3),
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Company_companyName_idx" ON "Company"("companyName")
    `);
    // Safety net: add columns if table already existed without them (older deployments)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "agreementStartDate" TIMESTAMP(3)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "agreementEndDate" TIMESTAMP(3)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Company_agreementEndDate_idx" ON "Company"("agreementEndDate")`);
  } catch(e) {
    // Table already exists, ignore
  }
};

// Run on first load
ensureCompanyTable();

module.exports = { prisma, SECRET, cors, getUser, requireAuth, toDate };
