const BASE = import.meta.env.VITE_API_URL || ""

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      /* ignore non-JSON error body */
    }
    throw new Error(`${res.status} ${detail}`)
  }
  return res.json()
}

const qs = (params = {}) => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  )
  const s = new URLSearchParams(clean).toString()
  return s ? `?${s}` : ""
}

export const api = {
  health: () => request("/api/health"),
  overview: () => request("/api/overview"),
  accounts: (params) => request(`/api/accounts${qs(params)}`),
  account: (id) => request(`/api/accounts/${encodeURIComponent(id)}`),
  transactions: (params) => request(`/api/transactions${qs(params)}`),
  alerts: (params) => request(`/api/alerts${qs(params)}`),
  updateAlert: (id, payload) =>
    request(`/api/alerts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  network: (params) => request(`/api/network${qs(params)}`),
  updateAccount: (id, payload) =>
    request(`/api/accounts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  investigation: (id) => request(`/api/investigations/${encodeURIComponent(id)}`),
  updateInvestigation: (id, payload) =>
    request(`/api/investigations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  appendFinding: (id, payload) =>
    request(`/api/investigations/${encodeURIComponent(id)}/findings`, { method: "POST", body: JSON.stringify(payload) }),
  investigationTimeline: (id) =>
    request(`/api/investigations/${encodeURIComponent(id)}/timeline`),
  aiQuery: (payload) =>
    request("/api/ai-investigator/query", { method: "POST", body: JSON.stringify(payload) }),
  generateReport: (payload) =>
    request("/api/reports/generate", { method: "POST", body: JSON.stringify(payload) }),
  reports: (params) => request(`/api/reports${qs(params)}`),
  report: (id) => request(`/api/reports/${encodeURIComponent(id)}`),
  entities: (params) => request(`/api/entities${qs(params)}`),
  clusters: (params) => request(`/api/clusters${qs(params)}`),
  embeddedPatterns: (params) => request(`/api/embedded_patterns${qs(params)}`),
  adminHealth: () => request("/api/admin/health"),
  users: (params) => request(`/api/admin/users${qs(params)}`),
  createUser: (payload) =>
    request("/api/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id, payload) =>
    request(`/api/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  rules: (params) => request(`/api/admin/rules${qs(params)}`),
  createRule: (payload) =>
    request("/api/admin/rules", { method: "POST", body: JSON.stringify(payload) }),
  updateRule: (id, payload) =>
    request(`/api/admin/rules/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateRulesBulk: (payload) =>
    request("/api/admin/rules", { method: "PATCH", body: JSON.stringify(payload) }),
  auditLogs: (params) => request(`/api/admin/audit-logs${qs(params)}`),
}

const PATTERN_LABELS = {
  circular_flow: "Circular Flow",
  fan_in: "Fan-In Consolidation",
  fan_out: "Fan-Out Disbursement",
  rapid_movement: "Rapid Movement / Pass-Through",
  behavioral_deviation: "Behavioral Deviation",
}

export function patternLabel(pattern) {
  const key = String(pattern || "").trim().toLowerCase()
  return PATTERN_LABELS[key] || String(pattern || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}