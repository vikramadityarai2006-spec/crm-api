const { prisma, cors, requireAuth } = require("./_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const user = requireAuth(req, res);
  if (!user) return;

  const id = req.query.id ? parseInt(req.query.id) : null;
  const type = req.query.type;

  try {
    // Status codes operations
    if (type === "status-codes") {
      if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });
      if (req.method === "POST") {
        const { code, label, color } = req.body;
        const item = await prisma.statusCode.upsert({ where:{code}, update:{label,color}, create:{code,label,color} });
        return res.json(item);
      }
      if (req.method === "DELETE") {
        await prisma.statusCode.update({ where:{code:req.body.code}, data:{active:false} });
        return res.json({ message:"Deleted" });
      }
    }

    // Single master by ID
    if (id) {
      if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });
      if (req.method === "PUT") {
        const item = await prisma.masterData.update({ where:{id}, data:{value:req.body.value} });
        return res.json(item);
      }
      if (req.method === "DELETE") {
        const existing = await prisma.masterData.findUnique({ where:{id} });
        await prisma.masterData.update({ where:{id}, data:{active:false} });

        // If an employee/owner is removed from the master list, reassign their
        // candidates to "Ex-AmpleLeap" instead of leaving the field pointing at
        // a name that no longer exists in the master list.
        if (existing && existing.category === "owners") {
          const EX_VALUE = "Ex-AmpleLeap";

          // Make sure "Ex-AmpleLeap" exists as a selectable owner going forward
          await prisma.masterData.upsert({
            where: { category_value: { category:"owners", value:EX_VALUE } },
            update: { active:true },
            create: { category:"owners", value:EX_VALUE },
          });

          const affected = await prisma.candidate.updateMany({
            where: { ownerName: existing.value, deleted:false },
            data: { ownerName: EX_VALUE },
          });

          if (affected.count > 0) {
            await prisma.auditLog.create({
              data: {
                action: "Owner Reassigned",
                recordName: existing.value,
                detail: `${affected.count} candidate(s) reassigned from "${existing.value}" to "${EX_VALUE}" after employee removal`,
                userId: user.id,
              },
            });
          }

          return res.json({ message:"Deactivated", reassigned: affected.count, reassignedTo: EX_VALUE });
        }

        return res.json({ message:"Deactivated" });
      }
    }

    // GET all masters
    if (req.method === "GET") {
      const [all, codes] = await Promise.all([
        prisma.masterData.findMany({ where:{active:true}, orderBy:{sortOrder:"asc"} }),
        prisma.statusCode.findMany({ where:{active:true} }),
      ]);
      const grouped = {}, groupedFull = {};
      for (const item of all) {
        if (!grouped[item.category]) { grouped[item.category]=[]; groupedFull[item.category]=[]; }
        grouped[item.category].push(item.value);
        groupedFull[item.category].push({ id:item.id, value:item.value });
      }
      return res.json({ ...grouped, statusCodes:codes, _full:groupedFull });
    }

    // POST - add master
    if (req.method === "POST") {
      if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });
      const { category, value } = req.body;
      const item = await prisma.masterData.upsert({
        where:{category_value:{category,value}}, update:{active:true}, create:{category,value}
      });
      return res.json(item);
    }

    res.status(405).json({ error:"Method not allowed" });
  } catch(err) { res.status(500).json({ error:err.message }); }
};
