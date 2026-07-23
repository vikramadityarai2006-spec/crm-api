const { prisma, cors, requireAuth, ready } = require("./_lib");

// Call Log — recruiters call JOINED candidates, record the outcome, and set a
// single tracking flag on the candidate:
//   red    = Left the company
//   yellow = Payment yet to receive
//   green  = Payment received
//
// Every call is stored in CallLog (full history). The candidate's *current*
// flag lives on Candidate.callFlag so lists and dashboards can filter on it.
const FLAGS = ["red", "yellow", "green"];

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = requireAuth(req, res);
  if (!user) return;

  try {
    // Make sure the CallLog table/column exist before the first query touches
    // them (the create runs on cold start and would otherwise be a race).
    await ready;

    // Guard against a stale Prisma client: if schema.prisma was not deployed,
    // prisma.callLog is undefined and every query below would throw a vague
    // "cannot read properties of undefined" error.
    if (!prisma.callLog) {
      return res.status(500).json({ error: "Call Log model missing. Deploy the updated prisma/schema.prisma and redeploy the API." });
    }
    // Recruiters only ever see/act on candidates they own.
    // ownScope = what this user is allowed to touch at all (never section-dependent).
    const ownScope = { deleted: false };
    if (user.role === "recruiter") ownScope.ownerName = { equals: user.name, mode: "insensitive" };
    // base = ownScope narrowed to the section + date range currently being viewed.
    const base = { ...ownScope };

    // Section decides WHICH candidates appear and which date the calendar
    // filters on, so the range always means something for what is on screen.
    const SECTIONS = {
      joined:      { where: { joiningStatus: { equals: "Joined",  mode: "insensitive" } }, dateField: "actualDOJ" },
      offered:     { where: { joiningStatus: { equals: "Offered", mode: "insensitive" } }, dateField: "offerMonth" },
      resignation: { where: { resignationAcceptance: { not: null } },                      dateField: "resignationDate" },
    };
    const section = SECTIONS[req.query.section] ? req.query.section : "joined";
    Object.assign(base, SECTIONS[section].where);

    // Optional From-To calendar filter on the section's own date field.
    const { from, to } = req.query;
    const df = {};
    if (from) { const f = new Date(from); if (!isNaN(f)) df.gte = f; }
    if (to)   { const t = new Date(to);   if (!isNaN(t)) { t.setHours(23,59,59,999); df.lte = t; } }
    if (Object.keys(df).length) base[SECTIONS[section].dateField] = df;

    // ─── History for one candidate ─────────────────────────────────────────
    if (req.method === "GET" && req.query.candidateId) {
      const candidateId = parseInt(req.query.candidateId, 10);
      if (!candidateId) return res.status(400).json({ error: "Invalid candidateId" });

      // Ownership check — a recruiter must not read another owner's history.
      const cand = await prisma.candidate.findFirst({ where: { ...ownScope, id: candidateId } });
      if (!cand) return res.status(404).json({ error: "Candidate not found or not accessible" });

      const logs = await prisma.callLog.findMany({
        where: { candidateId },
        orderBy: { calledAt: "desc" },
        take: 100,
        include: { calledBy: { select: { name: true } } },
      });
      return res.json(logs.map(l => ({
        id: l.id, flag: l.flag, notes: l.notes, calledAt: l.calledAt,
        calledByName: l.calledBy?.name || "—",
      })));
    }

    // ─── List joined candidates + their flag and last call ─────────────────
    if (req.method === "GET") {
      const { flag, search } = req.query;
      const where = { ...base };

      if (flag && FLAGS.includes(flag)) where.callFlag = flag;
      else if (flag === "none") where.callFlag = null;

      if (search && search.trim()) {
        where.OR = [
          { candidateName: { contains: search.trim(), mode: "insensitive" } },
          { clientName:    { contains: search.trim(), mode: "insensitive" } },
          { phone:         { contains: search.trim(), mode: "insensitive" } },
        ];
      }

      const candidates = await prisma.candidate.findMany({
        where,
        orderBy: [{ [SECTIONS[section].dateField]: "desc" }, { candidateName: "asc" }],
        select: {
          id: true, candidateName: true, clientName: true, designation: true,
          phone: true, email: true, actualDOJ: true, ownerName: true,
          callFlag: true, ctcPerMonth: true, offerMonth: true, proposedDOJ: true,
          joiningStatus: true, resignationAcceptance: true, resignationDate: true,
        },
      });

      // Attach each candidate's most recent call in one query rather than N.
      const ids = candidates.map(c => c.id);
      const recent = ids.length
        ? await prisma.callLog.findMany({
            where: { candidateId: { in: ids } },
            orderBy: { calledAt: "desc" },
            include: { calledBy: { select: { name: true } } },
          })
        : [];
      const lastByCandidate = {};
      const countByCandidate = {};
      for (const l of recent) {
        countByCandidate[l.candidateId] = (countByCandidate[l.candidateId] || 0) + 1;
        if (!lastByCandidate[l.candidateId]) lastByCandidate[l.candidateId] = l;
      }

      const rows = candidates.map(c => {
        const last = lastByCandidate[c.id];
        return {
          ...c,
          callCount: countByCandidate[c.id] || 0,
          lastCalledAt: last?.calledAt || null,
          lastNotes: last?.notes || null,
          lastCalledByName: last?.calledBy?.name || null,
        };
      });

      const counts = {
        all: rows.length,
        red: rows.filter(r => r.callFlag === "red").length,
        yellow: rows.filter(r => r.callFlag === "yellow").length,
        green: rows.filter(r => r.callFlag === "green").length,
        none: rows.filter(r => !r.callFlag).length,
      };

      return res.json({ rows, counts, section });
    }

    // ─── Log a call (and optionally update the flag) ────────────────────────
    if (req.method === "POST") {
      // Only recruiters make calls. Admins and viewers have oversight access
      // (read-only) — the Call Log is there for them to see what's going on.
      if (user.role !== "recruiter") {
        return res.status(403).json({ error: "Call Log is view-only for your role. Only recruiters can log calls." });
      }

      const { candidateId, flag, notes } = req.body || {};
      const id = parseInt(candidateId, 10);
      if (!id) return res.status(400).json({ error: "candidateId is required" });
      if (flag && !FLAGS.includes(flag)) return res.status(400).json({ error: "Invalid flag" });
      if (!flag && !(notes && notes.trim())) {
        return res.status(400).json({ error: "Add a note or select a flag" });
      }

      const cand = await prisma.candidate.findFirst({ where: { ...ownScope, id } });
      if (!cand) return res.status(404).json({ error: "Candidate not found or not accessible" });

      const log = await prisma.callLog.create({
        data: {
          candidateId: id,
          flag: flag || cand.callFlag || null,
          notes: (notes || "").trim() || null,
          calledById: user.id,
        },
      });

      // Update the candidate's current flag only when a new one was chosen.
      if (flag && flag !== cand.callFlag) {
        await prisma.candidate.update({ where: { id }, data: { callFlag: flag } });
      }

      const FLAG_LABEL = { red: "Left the company", yellow: "Payment yet to receive", green: "Payment received" };
      try {
        await prisma.auditLog.create({
          data: {
            action: "Call Logged",
            recordName: cand.candidateName,
            detail: flag ? `Flag: ${FLAG_LABEL[flag]}` : "Call note added",
            userId: user.id,
            candidateId: id,
          },
        });
      } catch (e) { /* never let audit failure block the call log */ }

      return res.status(201).json({ ...log, message: "Call logged" });
    }

    // ─── Delete a call entry (admin only) ──────────────────────────────────
    if (req.method === "DELETE") {
      if (user.role !== "admin") return res.status(403).json({ error: "Admin only" });
      const logId = parseInt(req.query.id, 10);
      if (!logId) return res.status(400).json({ error: "Invalid id" });
      await prisma.callLog.delete({ where: { id: logId } });
      return res.json({ message: "Deleted" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
