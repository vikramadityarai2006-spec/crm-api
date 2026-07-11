const BASE_URL = "https://crm-api-pied.vercel.app/api";
const getToken = () => sessionStorage.getItem("crm_token");
export const H = () => ({
  "Content-Type": "application/json",
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

// Handle response — auto-logout on 401
const handle = async (res) => {
  if (res.status === 401) {
    sessionStorage.removeItem("crm_token");
    sessionStorage.removeItem("crm_session_expires");
    window.dispatchEvent(new CustomEvent("crm_logout", { detail: "session_expired" }));
    return { error: "Session expired. Please login again." };
  }
  return res.json();
};

export const api = {
  // Auth
  login: (e, p) => fetch(`${BASE_URL}/auth`, {
    method: "POST", headers: H(), body: JSON.stringify({ email: e, password: p })
  }).then(r => r.json()),
  getMe: () => fetch(`${BASE_URL}/auth`, { headers: H() }).then(handle),

  // Candidates
  getCandidates: (p = {}) => fetch(`${BASE_URL}/candidates?${new URLSearchParams(p)}`, { headers: H() }).then(handle),
  getCandidate: (id) => fetch(`${BASE_URL}/candidates?id=${id}`, { headers: H() }).then(handle),
  getReports: (months = 6) => fetch(`${BASE_URL}/reports?months=${months}`, { headers: H() }).then(handle),
  getUserReport: () => fetch(`${BASE_URL}/reports?scope=owners`, { headers: H() }).then(handle),
  createCandidate: (d) => fetch(`${BASE_URL}/candidates`, { method: "POST", headers: H(), body: JSON.stringify(d) }).then(handle),
  updateCandidate: (id, d) => fetch(`${BASE_URL}/candidates?id=${id}`, { method: "PUT", headers: H(), body: JSON.stringify(d) }).then(handle),
  deleteCandidate: (id) => fetch(`${BASE_URL}/candidates?delete=1`, { method: "POST", headers: H(), body: JSON.stringify({ id }) }).then(handle),

  // Masters
  getMasters: () => fetch(`${BASE_URL}/masters`, { headers: H() }).then(handle),
  addMaster: (category, value) => fetch(`${BASE_URL}/masters`, { method: "POST", headers: H(), body: JSON.stringify({ category, value }) }).then(handle),
  updateMaster: (id, value) => fetch(`${BASE_URL}/masters?id=${id}`, { method: "PUT", headers: H(), body: JSON.stringify({ value }) }).then(handle),
  deleteMaster: (id) => fetch(`${BASE_URL}/masters?id=${id}`, { method: "DELETE", headers: H() }).then(handle),
  addStatusCode: (d) => fetch(`${BASE_URL}/masters?type=status-codes`, { method: "POST", headers: H(), body: JSON.stringify(d) }).then(handle),
  deleteStatusCode: (code) => fetch(`${BASE_URL}/masters?type=status-codes`, { method: "DELETE", headers: H(), body: JSON.stringify({ code }) }).then(handle),

  // Dashboard, Audit & Alerts
  getDashboard: () => fetch(`${BASE_URL}/dashboard`, { headers: H() }).then(handle),
  getAudit: () => fetch(`${BASE_URL}/audit`, { headers: H() }).then(handle),
  getAlerts: () => fetch(`${BASE_URL}/alerts`, { headers: H() }).then(handle),

  // Users
  getUsers: () => fetch(`${BASE_URL}/users`, { headers: H() }).then(handle),
  createUser: (d) => fetch(`${BASE_URL}/users`, { method: "POST", headers: H(), body: JSON.stringify(d) }).then(handle),
  updateUser: (id, d) => fetch(`${BASE_URL}/users?id=${id}`, { method: "PUT", headers: H(), body: JSON.stringify(d) }).then(handle),
  deleteUser: (id) => fetch(`${BASE_URL}/users?id=${id}`, { method: "DELETE", headers: H() }).then(handle),

  // Companies
  getCompanies: (p = {}) => fetch(`${BASE_URL}/companies?${new URLSearchParams(p)}`, { headers: H() }).then(handle),
  getCompany: (id) => fetch(`${BASE_URL}/companies?id=${id}`, { headers: H() }).then(handle),
  createCompany: (d) => fetch(`${BASE_URL}/companies`, { method: "POST", headers: H(), body: JSON.stringify(d) }).then(handle),
  updateCompany: (id, d) => fetch(`${BASE_URL}/companies?id=${id}`, { method: "PUT", headers: H(), body: JSON.stringify(d) }).then(handle),
  deleteCompany: (id) => fetch(`${BASE_URL}/companies?id=${id}`, { method: "DELETE", headers: H() }).then(handle),
};

export const BASE = BASE_URL;
