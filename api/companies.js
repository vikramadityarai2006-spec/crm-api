const { prisma, cors, requireAuth } = require("./_lib");

const build = (b) => ({
  companyName: b.companyName||"",
  spoc: b.spoc||null,
  contactName: b.contactName||null,
  department: b.department||null,
  mobile: b.mobile||null,
  email: b.email||null,
  address: b.address||null,
  dsc: b.dsc||"NO",
  hardcopy: b.hardcopy||"NO",
  serviceFee: b.serviceFee||null,
  agreementUrl: b.agreementUrl||null,
});

const SEED_DATA = [
  {companyName:"Alicon",spoc:"Yogita",contactName:"Dhananjay Kulkarni",department:"HR",mobile:"7028994509",email:"dhananjay.kulkarni@alicongroup.co.in",address:"Gat No: 1426, Village Shikrapur, Tal. Shirur, Dist. Pune 412208",dsc:"NO",hardcopy:"NO"},
  {companyName:"Alicon",spoc:"Yogita",contactName:"Ajit Dhumal",department:"HR",mobile:"8600102954",email:"ajit.dhumal@alicongroup.co.in",address:"",dsc:"NO",hardcopy:"NO"},
  {companyName:"CMR",spoc:"Sameer",contactName:"Ravi Tomar",department:"HR",mobile:"",email:"ravi.t@cmr.co.in",address:"7th Floor, Tower 2, L & T Business Park, 12/4 Delhi Mathura Road, Faridabad, Haryana 121003",dsc:"NO",hardcopy:"NO"},
  {companyName:"CMR",spoc:"Sameer",contactName:"Karishma",department:"HR",mobile:"",email:"karishma.s@cmr.co.in",address:"",dsc:"NO",hardcopy:"NO"},
  {companyName:"CMR",spoc:"Sameer",contactName:"Archana Mandal",department:"HR",mobile:"",email:"archana.m@cmr.co.in",address:"",dsc:"NO",hardcopy:"NO"},
  {companyName:"CMR",spoc:"Sameer",contactName:"Sanjay Singh",department:"HR",mobile:"",email:"sanjay.s@cmr.co.in",address:"",dsc:"NO",hardcopy:"NO"},
  {companyName:"FIL Industries",spoc:"Sameer",contactName:"Kamaljeet Kaur",department:"HR",mobile:"",email:"kamaljeetkaur@fil.net.in",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Kanoria",spoc:"Sameer",contactName:"Supriya Khurana",department:"HR",mobile:"",email:"supriya.khurana@kanoriachem.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Kanoria",spoc:"Sameer",contactName:"Prayag",department:"HR",mobile:"8826000516",email:"prayag@kplintl.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Metal Seam",spoc:"Manish",contactName:"Amitabh",department:"HR",mobile:"8935003083",email:"hr@metalseam.com",address:"Kanpur-Lucknow Rd, Gindan Khera, Nadarganj, Amausi, Lucknow, UP 226008",dsc:"NO",hardcopy:"NO"},
  {companyName:"Metal Seam",spoc:"Manish",contactName:"Neeraj",department:"HR",mobile:"8935003062",email:"career@metalseam.com",address:"Kanpur-Lucknow Rd, Gindan Khera, Nadarganj, Amausi, Lucknow, UP 226008",dsc:"NO",hardcopy:"NO"},
  {companyName:"Modern",spoc:"Sameer",contactName:"Arundhwaj Singh",department:"HR",mobile:"",email:"arundhwajsingh@moderninsulators.com",address:"Modern Metal Cast Component Pvt Ltd, Nidhrad Sanand-Kadi Road, Taluka Sanand, Ahmedabad 382210",dsc:"YES",hardcopy:"YES"},
  {companyName:"Modern",spoc:"Sameer",contactName:"A.S Ayyappan",department:"HR",mobile:"",email:"ayyappan@moderninsulators.com",address:"Modern Metal Cast Component Pvt Ltd, Nidhrad Sanand-Kadi Road, Taluka Sanand, Ahmedabad 382210",dsc:"YES",hardcopy:"YES"},
  {companyName:"Payal Group",spoc:"",contactName:"Rohan Kapoor",department:"HR",mobile:"9871001246",email:"rohankapoor@payalgroup.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Payal Group",spoc:"",contactName:"Mousumi Ganguly",department:"HR",mobile:"",email:"mousumiganguly@payalgroup.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Skylark",spoc:"",contactName:"Samridhi Arora",department:"HR",mobile:"8950930139",email:"samridhi@skylarkfeeds.com",address:"Plot No. 491, Food Park, HSIDC Industrial Estate, Grand Trunk Rd, Sonipat, Haryana 131029",dsc:"YES",hardcopy:"YES"},
  {companyName:"SM Auto",spoc:"Sanjay",contactName:"Santosh",department:"HR",mobile:"7385567093",email:"careers@smauto.co.in",address:"SM Auto Engineering Pvt Ltd, Plot B-19, H-Block, MIDC, Pimpri, Pune 411018",dsc:"YES",hardcopy:"YES"},
  {companyName:"SM Auto",spoc:"Sanjay",contactName:"Anurag Raut",department:"HR",mobile:"7709044413",email:"a.raut@smauto.co.in",address:"SM Auto Engineering Pvt Ltd, Plot B-19, H-Block, MIDC, Pimpri, Pune 411018",dsc:"YES",hardcopy:"YES"},
  {companyName:"Sogefi",spoc:"",contactName:"Sapan Sharma",department:"HR",mobile:"8263852266",email:"sapan.sharma@sogefigroup.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Sogefi",spoc:"",contactName:"Bhushan Borade",department:"HR",mobile:"6366758661",email:"bhushan.borade@sogefigroup.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Suspa",spoc:"",contactName:"Bala Kumaran",department:"HR",mobile:"8825999820",email:"balakumaran@in.suspa.com",address:"SUSPA Pneumatics India Pvt Ltd, Guduvancheri-Tiruporur Road, Pandur Village, Kannivakkam, 603202",dsc:"YES",hardcopy:"YES"},
  {companyName:"Vansh",spoc:"Pragya",contactName:"Ankur",department:"HR",mobile:"",email:"hrd@vanshindustries.in",address:"Vansh Industries, P.O. Guru Majara, Village KishanPura, Tehsil Nalagarh, Distt Solan, HP 174101",dsc:"YES",hardcopy:"YES"},
  {companyName:"Vansh",spoc:"Pragya",contactName:"Shailendra Garg",department:"Accounts",mobile:"7838969653",email:"",address:"Vansh Industries, P.O. Guru Majara, Village KishanPura, Tehsil Nalagarh, Distt Solan, HP 174101",dsc:"YES",hardcopy:"YES"},
  {companyName:"Vista",spoc:"",contactName:"Manasi Deshmukh",department:"HR",mobile:"7744846798",email:"manasi.deshmukh@vista-osi-group.com",address:"Vista Processed Foods Pvt Ltd, D-904, Tower 2, L&T Seawoods Mall, Sector-40, Nerul, Navi Mumbai 400706",dsc:"YES",hardcopy:"YES"},
  {companyName:"Vista",spoc:"",contactName:"Rajinder",department:"HR",mobile:"8725004500",email:"rajinder@vista-osi-group.com",address:"Vista Processed Foods Pvt Ltd, D-904, Tower 2, L&T Seawoods Mall, Sector-40, Nerul, Navi Mumbai 400706",dsc:"YES",hardcopy:"YES"},
  {companyName:"Vista",spoc:"",contactName:"Anjana Bhosale",department:"HR",mobile:"",email:"anjana@vista-osi-group.com",address:"Vista Processed Foods Pvt Ltd, D-904, Tower 2, L&T Seawoods Mall, Sector-40, Nerul, Navi Mumbai 400706",dsc:"YES",hardcopy:"YES"},
  {companyName:"Zytex",spoc:"",contactName:"Mamta Patil",department:"HR",mobile:"9324082566",email:"m.patil@zytex.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Zytex",spoc:"",contactName:"Peenaz Patel",department:"HR",mobile:"",email:"peenaz.patel@zytex.com",address:"",dsc:"YES",hardcopy:"YES"},
];

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const user = requireAuth(req, res);
  if (!user) return;

  const id = req.query.id ? parseInt(req.query.id) : null;

  try {
    // Auto-seed if table is empty
    const autoSeed = async () => {
      const count = await prisma.company.count();
      if (count === 0) {
        for (const c of SEED_DATA) {
          try { await prisma.company.create({ data: c }); } catch(e) {}
        }
      }
    };

    if (id) {
      if (req.method === "GET") {
        const c = await prisma.company.findUnique({ where:{id} });
        if (!c||!c.active) return res.status(404).json({ error:"Not found" });
        return res.json(c);
      }
      if (req.method === "PUT") {
        if (!["admin","recruiter"].includes(user.role)) return res.status(403).json({ error:"Not allowed" });
        const c = await prisma.company.update({ where:{id}, data:{...build(req.body), updatedAt:new Date()} });
        return res.json(c);
      }
      if (req.method === "DELETE") {
        if (user.role !== "admin") return res.status(403).json({ error:"Admin only" });
        await prisma.company.update({ where:{id}, data:{active:false} });
        return res.json({ message:"Deleted" });
      }
    }

    if (req.method === "GET") {
      await autoSeed();
      const { search, company, page=1, limit=50 } = req.query;
      const where = { active:true };
      if (search) where.OR = [
        {companyName:{contains:search,mode:"insensitive"}},
        {contactName:{contains:search,mode:"insensitive"}},
        {email:{contains:search,mode:"insensitive"}},
        {mobile:{contains:search,mode:"insensitive"}},
        {spoc:{contains:search,mode:"insensitive"}},
      ];
      if (company) where.companyName = {contains:company,mode:"insensitive"};
      const skip = (parseInt(page)-1)*parseInt(limit);
      const [total, companies] = await Promise.all([
        prisma.company.count({where}),
        prisma.company.findMany({where, orderBy:{companyName:"asc"}, skip, take:parseInt(limit)}),
      ]);
      return res.json({companies, total, page:parseInt(page), pages:Math.ceil(total/parseInt(limit))});
    }

    if (req.method === "POST") {
      if (!["admin","recruiter"].includes(user.role)) return res.status(403).json({ error:"Not allowed" });
      const c = await prisma.company.create({ data:build(req.body) });
      return res.status(201).json(c);
    }

    res.status(405).json({ error:"Method not allowed" });
  } catch(err) {
    res.status(500).json({ error:err.message });
  }
};
