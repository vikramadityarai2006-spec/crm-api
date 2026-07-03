const { prisma, cors, requireAuth } = require("./_lib");

const COMPANIES = [
  {companyName:"Alicon",spoc:"Yogita",contactName:"dhananjay kulkarni",department:"HR",mobile:"7028994509",email:"dhananjay.kulkarni@alicongroup.co.in",address:"Gat No: 1426, Village Shikrapur, Tal. Shirur, Dist. Pune 412 208 Maharashtra",dsc:"NO",hardcopy:"NO"},
  {companyName:"Alicon",spoc:"Yogita",contactName:"Ajit Dhumal",department:"HR",mobile:"8600102954",email:"ajit.dhumal@alicongroup.co.in",address:"",dsc:"NO",hardcopy:"NO"},
  {companyName:"CMR",spoc:"Sameer",contactName:"Ravi Tomar",department:"HR",mobile:"",email:"ravi.t@cmr.co.in",address:"7th Floor, Tower 2, L & T Business Park, 12/4 Delhi Mathura Road, Faridabad, Haryana, 121003",dsc:"NO",hardcopy:"NO"},
  {companyName:"CMR",spoc:"Sameer",contactName:"Karishma",department:"HR",mobile:"",email:"karishma.s@cmr.co.in",address:"",dsc:"NO",hardcopy:"NO"},
  {companyName:"CMR",spoc:"Sameer",contactName:"Archana Mandal",department:"HR",mobile:"",email:"archana.m@cmr.co.in",address:"",dsc:"NO",hardcopy:"NO"},
  {companyName:"CMR",spoc:"Sameer",contactName:"Sanjay Singh",department:"HR",mobile:"",email:"sanjay.s@cmr.co.in",address:"",dsc:"NO",hardcopy:"NO"},
  {companyName:"FIL industries",spoc:"Sameer",contactName:"Kamaljeet Kaur",department:"HR",mobile:"",email:"kamaljeetkaur@fil.net.in",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Kanoria",spoc:"Sameer",contactName:"supriya khurana",department:"HR",mobile:"",email:"supriya.khurana@kanoriachem.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Kanoria",spoc:"Sameer",contactName:"prayag",department:"HR",mobile:"8826000516",email:"prayag@kplintl.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Metal Seam",spoc:"Manish",contactName:"Amitabh",department:"HR",mobile:"8935003083",email:"hr@metalseam.com",address:"Kanpur - Lucknow Rd, Gindan Khera, Nadarganj, Amausi, Lucknow, Uttar Pradesh 226008",dsc:"NO",hardcopy:"NO"},
  {companyName:"Metal Seam",spoc:"Manish",contactName:"Neeraj",department:"HR",mobile:"8935003062",email:"career@metalseam.com",address:"Kanpur - Lucknow Rd, Gindan Khera, Nadarganj, Amausi, Lucknow, Uttar Pradesh 226009",dsc:"NO",hardcopy:"NO"},
  {companyName:"Modern",spoc:"Sameer",contactName:"Arundhwaj Singh",department:"HR",mobile:"",email:"arundhwajsingh@moderninsulators.com",address:"Modern Metal Cast Component Pvt Ltd, Nidhrad Sanand - Kadi Road, Taluka- Sanand, District - Ahmedabad (Guj) - 382210",dsc:"YES",hardcopy:"YES"},
  {companyName:"Modern",spoc:"Sameer",contactName:"A.S Ayyappan",department:"HR",mobile:"",email:"ayyappan@moderninsulators.com",address:"Modern Metal Cast Component Pvt Ltd, Nidhrad Sanand - Kadi Road, Taluka- Sanand, District - Ahmedabad (Guj) - 382211",dsc:"YES",hardcopy:"YES"},
  {companyName:"Payal Group",spoc:"",contactName:"Rohan Kapoor",department:"HR",mobile:"9871001246",email:"rohankapoor@payalgroup.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Payal Group",spoc:"",contactName:"Mousumi Ganguly",department:"HR",mobile:"",email:"mousumiganguly@payalgroup.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Skylark",spoc:"",contactName:"Samridhi Arora",department:"HR",mobile:"8950930139",email:"samridhi@skylarkfeeds.com",address:"Plot No. 491, Food Park, HSIDC Industrial Estate, Grand Trunk Rd, Sonipat, Haryana 131029",dsc:"YES",hardcopy:"YES"},
  {companyName:"SM Auto",spoc:"Sanjay",contactName:"Santosh",department:"HR",mobile:"7385567093",email:"careers@smauto.co.in",address:"SM Auto Engineering Private Limited, Plot B-19, H-Block, M.I.D.C, Pimpri, Pune, Maharashtra-411018",dsc:"YES",hardcopy:"YES"},
  {companyName:"SM Auto",spoc:"Sanjay",contactName:"Anurag Raut",department:"HR",mobile:"7709044413",email:"a.raut@smauto.co.in",address:"SM Auto Engineering Private Limited, Plot B-19, H-Block, M.I.D.C, Pimpri, Pune, Maharashtra-411019",dsc:"YES",hardcopy:"YES"},
  {companyName:"Sogefi",spoc:"",contactName:"Sapan Sharma",department:"HR",mobile:"8263852266",email:"sapan.sharma@sogefigroup.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Sogefi",spoc:"",contactName:"Bhushan Borade",department:"HR",mobile:"6366758661",email:"bhushan.borade@sogefigroup.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Suspa",spoc:"",contactName:"bala kumaran",department:"HR",mobile:"8825999820",email:"balakumaran@in.suspa.com",address:"SUSPA Pneumatics (India) Pvt. Ltd. | Guduvancheri-Tiruporur Road | Pandur Village No. 16 | Kannivakkam P.O.Guduvancheri - 603 202",dsc:"YES",hardcopy:"YES"},
  {companyName:"Vansh",spoc:"Pragya",contactName:"Ankur",department:"HR",mobile:"",email:"hrd@vanshindustries.in",address:"Vansh Industries P.O. Guru Majara, Village: KishanPura Tehsil: Nalagarh Distt: Solan H.P.-174101",dsc:"YES",hardcopy:"YES"},
  {companyName:"Vansh",spoc:"Pragya",contactName:"Shailendra Garg",department:"Accounts",mobile:"7838969653",email:"",address:"Vansh Industries P.O. Guru Majara, Village: KishanPura Tehsil: Nalagarh Distt: Solan H.P.-174102",dsc:"YES",hardcopy:"YES"},
  {companyName:"Vista",spoc:"",contactName:"manasi deshmukh",department:"HR",mobile:"7744846798",email:"manasi.deshmukh@vista-osi-group.com",address:"Vista Processed Foods Pvt. Ltd., D-904, Tower 2, L&T Seawoods Mall, Sector-40, Nerul, Navi Mumbai, Maharashtra 400706",dsc:"YES",hardcopy:"YES"},
  {companyName:"Vista",spoc:"",contactName:"rajinder",department:"HR",mobile:"8725004500",email:"rajinder@vista-osi-group.com",address:"Vista Processed Foods Pvt. Ltd., D-904, Tower 2, L&T Seawoods Mall, Sector-40, Nerul, Navi Mumbai, Maharashtra 400707",dsc:"YES",hardcopy:"YES"},
  {companyName:"Vista",spoc:"",contactName:"Anjana Bhosale",department:"HR",mobile:"",email:"anjana@vista-osi-group.com",address:"Vista Processed Foods Pvt. Ltd., D-904, Tower 2, L&T Seawoods Mall, Sector-40, Nerul, Navi Mumbai, Maharashtra 400708",dsc:"YES",hardcopy:"YES"},
  {companyName:"Zytex",spoc:"",contactName:"Mamta Patil",department:"HR",mobile:"9324082566",email:"m.patil@zytex.com",address:"",dsc:"YES",hardcopy:"YES"},
  {companyName:"Zytex",spoc:"",contactName:"Peenaz Patel",department:"HR",mobile:"",email:"peenaz.patel@zytex.com",address:"",dsc:"YES",hardcopy:"YES"},
];

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  // Only an authenticated admin should be able to trigger seeding
  const user = requireAuth(req, res);
  if (!user) return;
  if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  try {
    // Check if Company table exists and seed if empty
    const count = await prisma.company.count();
    if (count === 0) {
      let seeded = 0;
      for (const c of COMPANIES) {
        try {
          await prisma.company.create({ data: c });
          seeded++;
        } catch(e) {}
      }
      return res.json({ message: `Seeded ${seeded} companies!`, count: seeded });
    }
    return res.json({ message: "Already seeded", count });
  } catch(err) {
    // Table doesn't exist
    return res.status(500).json({ error: err.message, hint: "Company table not found. Schema push needed." });
  }
};
