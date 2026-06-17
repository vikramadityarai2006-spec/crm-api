const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const prisma = global.prisma || new PrismaClient();
if (!global.prisma) global.prisma = prisma;
const SECRET = process.env.JWT_SECRET || "ampleleap-crm-super-secret-key-2024";

const CORS = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
};

const auth = (req) => {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    return jwt.verify(token, SECRET);
  } catch { return null; }
};

const SEED = [
  {
    "companyName": "Alicon",
    "spoc": "Yogita",
    "contactName": "dhananjay kulkarni",
    "department": "HR",
    "mobile": "7028994509",
    "email": "dhananjay.kulkarni@alicongroup.co.in",
    "address": "Gat No: 1426, Village Shikrapur, Tal. Shirur, Dist. Pune 412 208 Maharashtra",
    "dsc": "NO",
    "hardcopy": "NO",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Alicon",
    "spoc": "Yogita",
    "contactName": "Ajit Dhumal",
    "department": "HR",
    "mobile": "8600102954",
    "email": "ajit.dhumal@alicongroup.co.in",
    "address": "",
    "dsc": "NO",
    "hardcopy": "NO",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "CMR",
    "spoc": "Sameer",
    "contactName": "Ravi Tomar",
    "department": "HR",
    "mobile": "",
    "email": "ravi.t@cmr.co.in",
    "address": "7th Floor, Tower 2, L & T Business Park, 12/4 Delhi Mathura Road, Faridabad, Haryana, 121003",
    "dsc": "NO",
    "hardcopy": "NO",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "CMR",
    "spoc": "Sameer",
    "contactName": "Karishma",
    "department": "HR",
    "mobile": "",
    "email": "karishma.s@cmr.co.in",
    "address": "",
    "dsc": "NO",
    "hardcopy": "NO",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "CMR",
    "spoc": "Sameer",
    "contactName": "Archana Mandal",
    "department": "HR",
    "mobile": "",
    "email": "archana.m@cmr.co.in",
    "address": "",
    "dsc": "NO",
    "hardcopy": "NO",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "CMR",
    "spoc": "Sameer",
    "contactName": "Sanjay Singh",
    "department": "HR",
    "mobile": "",
    "email": "sanjay.s@cmr.co.in",
    "address": "",
    "dsc": "NO",
    "hardcopy": "NO",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "FIL industries",
    "spoc": "Sameer",
    "contactName": "Kamaljeet Kaur",
    "department": "HR",
    "mobile": "",
    "email": "kamaljeetkaur@fil.net.in",
    "address": "",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "KPL International Limited Kanoria",
    "spoc": "Sameer",
    "contactName": "supriya khurana",
    "department": "HR",
    "mobile": "",
    "email": "supriya.khurana@kanoriachem.com",
    "address": "",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "KPL International Limited Kanoria",
    "spoc": "Sameer",
    "contactName": "prayag",
    "department": "HR",
    "mobile": "8826000516",
    "email": "prayag@kplintl.com",
    "address": "",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Metal Seam",
    "spoc": "Manish",
    "contactName": "Amitabh",
    "department": "HR",
    "mobile": "8935003083",
    "email": "hr@metalseam.com",
    "address": "Kanpur - Lucknow Rd, Gindan Khera, Nadarganj, Amausi, Lucknow, Uttar Pradesh 226008",
    "dsc": "NO",
    "hardcopy": "NO",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Metal Seam",
    "spoc": "Manish",
    "contactName": "Neeraj",
    "department": "HR",
    "mobile": "8935003062",
    "email": "career@metalseam.com",
    "address": "Kanpur - Lucknow Rd, Gindan Khera, Nadarganj, Amausi, Lucknow, Uttar Pradesh 226009",
    "dsc": "NO",
    "hardcopy": "NO",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Modern",
    "spoc": "Sameer",
    "contactName": "Arundhwaj Singh",
    "department": "HR",
    "mobile": "",
    "email": "arundhwajsingh@moderninsulators.com",
    "address": "Modern Metal Cast Component Pvt Ltd, Nidhrad Sanand - Kadi Road, Taluka- Sanand, District - Ahmedabad (Guj) - 382210",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Modern",
    "spoc": "Sameer",
    "contactName": "A.S Ayyappan",
    "department": "HR",
    "mobile": "",
    "email": "ayyappan@moderninsulators.com",
    "address": "Modern Metal Cast Component Pvt Ltd, Nidhrad Sanand - Kadi Road, Taluka- Sanand, District - Ahmedabad (Guj) - 382211",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Payal Group",
    "spoc": "",
    "contactName": "Rohan Kapoor",
    "department": "HR",
    "mobile": "9871001246",
    "email": "rohankapoor@payalgroup.com",
    "address": "",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Payal Group",
    "spoc": "",
    "contactName": "Mousumi Ganguly",
    "department": "HR",
    "mobile": "",
    "email": "mousumiganguly@payalgroup.com",
    "address": "",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Skylark",
    "spoc": "",
    "contactName": "Samridhi Arora",
    "department": "HR",
    "mobile": "8950930139",
    "email": "samridhi@skylarkfeeds.com",
    "address": "Skylark foods (Skylark Foods Private Limited) Adress -Plot No. 491, Food Park, HSIDC Industrial Estate, Grand Trunk Rd, Sonipat, Haryana 131029",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "SM Auto",
    "spoc": "Sanjay",
    "contactName": "Santosh",
    "department": "HR",
    "mobile": "7385567093",
    "email": "careers@smauto.co.in",
    "address": "SM Auto Engineering Private Limited, Plot B-19, H-Block, M.I.D.C, Pimpri, Pune, Maharashtra-411018",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "SM Auto",
    "spoc": "Sanjay",
    "contactName": "Anurag Raut",
    "department": "HR",
    "mobile": "7709044413",
    "email": "a.raut@smauto.co.in",
    "address": "SM Auto Engineering Private Limited, Plot B-19, H-Block, M.I.D.C, Pimpri, Pune, Maharashtra-411019",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Sogefi",
    "spoc": "",
    "contactName": "Sapan Sharma",
    "department": "HR",
    "mobile": "8263852266",
    "email": "sapan.sharma@sogefigroup.com",
    "address": "",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Sogefi",
    "spoc": "",
    "contactName": "Bhushan Borade",
    "department": "HR",
    "mobile": "6366758661",
    "email": "bhushan.borade@sogefigroup.com",
    "address": "",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Suspa",
    "spoc": "",
    "contactName": "bala kumaran",
    "department": "HR",
    "mobile": "8825999820",
    "email": "balakumaran@in.suspa.com",
    "address": "SUSPA Pneumatics (India) Pvt. Ltd. | Guduvancheri-Tiruporur Road | Pandur Village No. 16 | Kannivakkam P.O.Guduvancheri - 603 202",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Vansh",
    "spoc": "Pragya",
    "contactName": "Ankur",
    "department": "HR",
    "mobile": "",
    "email": "hrd@vanshindustries.in",
    "address": "Vansh Industries P.O. Guru Majara, Village: KishanPura Tehsil: Nalagarh Distt: Solan H.P.-174101",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Vansh",
    "spoc": "Pragya",
    "contactName": "Shailendra Garg",
    "department": "Accounts",
    "mobile": "7838969653",
    "email": "",
    "address": "Vansh Industries P.O. Guru Majara, Village: KishanPura Tehsil: Nalagarh Distt: Solan H.P.-174102",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Vista",
    "spoc": "",
    "contactName": "manasi deshmukh",
    "department": "HR",
    "mobile": "7744846798",
    "email": "manasi.deshmukh@vista-osi-group.com",
    "address": "Vista Processed Foods Pvt. Ltd., D-904 , Tower 2 , L&T Seawoods Mall , Sector-40, Nerul , Navi Mumbai , Maharashtra \u2013 400 706",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Vista",
    "spoc": "",
    "contactName": "rajinder",
    "department": "HR",
    "mobile": "8725004500",
    "email": "rajinder@vista-osi-group.com",
    "address": "Vista Processed Foods Pvt. Ltd., D-904 , Tower 2 , L&T Seawoods Mall , Sector-40, Nerul , Navi Mumbai , Maharashtra \u2013 400 707",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Vista",
    "spoc": "",
    "contactName": "Anjana Bhosale",
    "department": "HR",
    "mobile": "",
    "email": "anjana@vista-osi-group.com",
    "address": "Vista Processed Foods Pvt. Ltd., D-904 , Tower 2 , L&T Seawoods Mall , Sector-40, Nerul , Navi Mumbai , Maharashtra \u2013 400 708",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Zytex",
    "spoc": "",
    "contactName": "Mamta Patil",
    "department": "HR",
    "mobile": "9324082566",
    "email": "m.patil@zytex.com",
    "address": "",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  },
  {
    "companyName": "Zytex",
    "spoc": "",
    "contactName": "Peenaz Patel",
    "department": "HR",
    "mobile": "",
    "email": "peenaz.patel@zytex.com",
    "address": "",
    "dsc": "YES",
    "hardcopy": "YES",
    "serviceFee": "",
    "agreementUrl": ""
  }
];

const autoSeed = async () => {
  try {
    const count = await prisma.company.count();
    if (count === 0) {
      for (const c of SEED) {
        try { await prisma.company.create({ data: c }); } catch(e) {}
      }
    }
  } catch(e) {}
};

module.exports = async (req, res) => {
  CORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  
  const user = auth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = req.query.id ? parseInt(req.query.id) : null;

  try {
    if (id) {
      if (req.method === "GET") {
        const c = await prisma.company.findUnique({ where: { id } });
        return res.json(c || { error: "Not found" });
      }
      if (req.method === "PUT") {
        const c = await prisma.company.update({ where: { id }, data: { ...req.body, updatedAt: new Date() } });
        return res.json(c);
      }
      if (req.method === "DELETE") {
        if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });
        await prisma.company.update({ where: { id }, data: { active: false } });
        return res.json({ message: "Deleted" });
      }
    }

    if (req.method === "GET") {
      await autoSeed();
      const { search, company, page = 1, limit = 50 } = req.query;
      const where = { active: true };
      if (search) where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search, mode: "insensitive" } },
      ];
      if (company) where.companyName = { contains: company, mode: "insensitive" };
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [total, companies] = await Promise.all([
        prisma.company.count({ where }),
        prisma.company.findMany({ where, orderBy: { companyName: "asc" }, skip, take: parseInt(limit) }),
      ]);
      return res.json({ companies, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    }

    if (req.method === "POST") {
      const c = await prisma.company.create({ data: req.body });
      return res.status(201).json(c);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
