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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
};

const getUser = (req) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.replace("Bearer ", "");
    if (!token) return null;
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
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

module.exports = { prisma, SECRET, cors, getUser, requireAuth, toDate };
