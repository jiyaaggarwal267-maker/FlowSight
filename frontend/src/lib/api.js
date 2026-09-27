// API calls are always same-origin.
//
// `import.meta.env.VITE_*` values are inlined into the bundle at BUILD time,
// so a VITE_API_URL left in a .env file gets baked into the production build
// and every visitor's browser then calls that literal address — a leftover
// `VITE_API_URL=http://localhost:8000` makes the deployed site request
// localhost and fail with ERR_CONNECTION_REFUSED. To make that impossible:
//   - production builds ignore VITE_API_URL entirely and use relative paths,
//     which is correct because FastAPI serves the UI and the API from one URL;
//   - `vite dev` proxies /api to the local backend (see vite.config.js), so
//     local development needs no environment variable either. The escape hatch
//     is honoured in dev only, for pointing a dev build at another host.
const configured = import.meta.env.VITE_API_URL || ""
const BASE =
  import.meta.env.DEV && /^https?:\/\//i.test(configured) ? configured.replace(/\/+$/, "") : ""

// A request can fail for reasons that resolve on their own: the FastAPI Cloud
// container scales to zero when idle, so the first request after a gap has to
// wake it and can be reset or answered by a gateway while it boots. Treating
// that as a hard error is what made the site look permanently broken. Retrying
// with backoff turns a cold start into a short wait instead of an error page.
const TIMEOUT_MS = 20000
const RETRY_DELAYS = [400, 1200, 3000, 6000]
// 408/429 and every 5xx are transient. 4xx are not: retrying a 404 or a 422
// only wastes the user's time and hides real bugs.
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

export class ApiUnavailableError extends Error {
  constructor(message, { cause } = {}) {
    super(message)
    this.name = "ApiUnavailableError"
    this.cause = cause
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function once(path, options, signal) {
  const controller = new AbortController()
  const onAbort = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) onAbort()
    else signal.addEventListener("abort", onAbort, { once: true })
  }
  // Distinguish "the caller navigated away" from "we ran out of time".
  const timer = setTimeout(
    () => controller.abort(new ApiUnavailableError(`Request timed out after ${TIMEOUT_MS}ms`)),
    TIMEOUT_MS,
  )
  try {
    return await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      cache: "no-store",
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}

/**
 * fetch with the same timeout + backoff policy used by `request`, but returning
 * the raw Response so callers that need a blob or a status can handle it.
 */
async function retryingFetch(path, options = {}, attempt = 0) {
  let res
  try {
    res = await once(path, options, options.signal)
  } catch (err) {
    if (options.signal?.aborted && !(err instanceof ApiUnavailableError)) throw err
    if (attempt < RETRY_DELAYS.length) {
      await sleep(RETRY_DELAYS[attempt])
      return retryingFetch(path, options, attempt + 1)
    }
    throw new ApiUnavailableError(
      "Cannot reach the FLOWSIGHT API. It may be starting up — this usually clears in a few seconds.",
      { cause: err },
    )
  }
  if (RETRYABLE_STATUS.has(res.status) && attempt < RETRY_DELAYS.length) {
    await sleep(RETRY_DELAYS[attempt])
    return retryingFetch(path, options, attempt + 1)
  }
  return res
}

async function request(path, options = {}, attempt = 0) {
  const res = await retryingFetch(path, options, attempt)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      /* ignore non-JSON error body */
    }
    if (RETRYABLE_STATUS.has(res.status)) {
      throw new ApiUnavailableError(`The API is unavailable (${res.status} ${detail}).`)
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
  speak: async (text, language = "en") => {
    const res = await retryingFetch("/api/tts/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
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
    return res.blob()
  },
}

/**
 * Block until the API reports the seeded database is ready.
 *
 * FastAPI Cloud scales to zero, so a cold container answers /api/health with
 * `status: "starting"` while it seeds. Calling this before the first page load
 * turns that into a brief wait instead of a failed request.
 */
export async function waitForApi({ timeoutMs = 60000, intervalMs = 700 } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const res = await retryingFetch("/api/health")
      if (res.ok) {
        const health = await res.json().catch(() => ({}))
        if (health.status === "ok") return health
        lastError = new ApiUnavailableError(`API is ${health.status || "starting"}`)
      } else {
        lastError = new ApiUnavailableError(`API returned ${res.status}`)
      }
    } catch (err) {
      lastError = err
    }
    await sleep(intervalMs)
  }
  throw lastError || new ApiUnavailableError("The API did not become ready in time.")
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