const { cors } = require("./_lib");

module.exports = (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  res.json({ status: "ok", message: "Ample Leap CRM API", version: "6.0.0" });
};
