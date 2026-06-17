const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");

let prisma;
if (!global.prisma) {
  global.prisma = new PrismaClient();
}
prisma = global.prisma;

const SECRET = process.env.JWT_SECRET || "ampleleap-crm-super-secret-key-2024";

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
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Company_companyName_idx" ON "Company"("companyName")
    `);
  } catch(e) {
    // Table already exists, ignore
  }
};

// Run on first load
ensureCompanyTable();

module.exports = { prisma, SECRET, cors, getUser, requireAuth, toDate };
