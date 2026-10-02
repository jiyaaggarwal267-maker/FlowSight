import { bus } from "./runtime.js"

// sessionStorage (not localStorage): the notice is a "first entry after login"
// courtesy, so it returns on a new tab / new session but never nags repeatedly.
export const CONTEXT_SEEN_KEY = "flowsight-context-seen"

export const AUDIENCE = [
  { icon: "badge", label: "Compliance Analysts" },
  { icon: "account_balance", label: "Financial Intelligence Units" },
  { icon: "fact_check", label: "Internal Audit & Regulators" },
]

// Fixed demo sequence. `target` is the element the callout anchors to;
// `also` lists extra elements that get a spotlight hole but no callout.
export const TOUR_STEPS = [
  {
    id: "command-center",
    path: "/analyst/overview",
    target: '[data-tour="overview-kpis"]',
    also: ['[data-tour="overview-graph"]'],
    icon: "dashboard",
    eyebrow: "Analyst Overview",
    title: "The analyst's daily command center",
    body: "Monitored transactions, active high-risk alerts and a live topology of suspicious activity — one screen per shift, no swivel-chair required.",
  },
  {
    id: "network-explorer",
    path: "/analyst/network-explorer",
    target: '[data-tour="nx-graph"]',
    icon: "hub",
    eyebrow: "Network Explorer",
    title: "Every account becomes a node",
    body: "Accounts and transactions resolve into one interactive graph, surfacing shared counterparties and layered hops that a flat transaction list can never show.",
  },
  {
    id: "dossier",
    path: "/analyst/investigations/INV-001",
    target: '[data-tour="inv-evidence"]',
    also: ['[data-tour="inv-risk"]'],
    icon: "psychology_alt",
    eyebrow: "Investigation Dossier",
    title: "Full evidence trail, never a black box",
    body: "Every alert opens with the rule that fired, the accounts and transactions in scope, and the underlying records — each ledger row expands into its raw forensic payload.",
  },
  {
    id: "timeline",
    path: "/analyst/flow-timeline",
    target: '[data-tour="ft-scrubber"]',
    icon: "history",
    eyebrow: "Flow Timeline",
    title: "Watch the network form itself",
    body: "Scrub day by day and replay how a funnel account network assembled over weeks — layering, then fan-out, then the off-ramp. What took weeks to detect takes seconds to see.",
  },
  {
    id: "ai-investigator",
    path: "/analyst/ai-investigator",
    target: '[data-tour="ai-query"]',
    icon: "auto_awesome",
    eyebrow: "AI Investigator",
    title: "Ask in plain language, get cited answers",
    body: "Pose a hypothesis about the network in your own words. Every answer comes back with the specific transaction records and entities it rests on — nothing is asserted without a citation.",
  },
  {
    id: "detection-rules",
    path: "/admin/rules",
    target: '[data-tour="rules-grid"]',
    icon: "rule",
    eyebrow: "Admin Console · Detection Rules",
    title: "Compliance owns detection sensitivity",
    body: "Analyst-facing tooling, but the thresholds are tuned by the compliance team — not engineers — and every change is staged, dual-authorised and written to the audit trail.",
  },
]

export function hasSeenContext() {
  try { return sessionStorage.getItem(CONTEXT_SEEN_KEY) === "1" } catch { return false }
}

export function markContextSeen() {
  try { sessionStorage.setItem(CONTEXT_SEEN_KEY, "1") } catch { /* storage unavailable */ }
}

export function openContextModal() {
  bus.emit("open-context")
}

export function startTour(stepIndex = 0) {
  bus.emit("open-tour", { stepIndex })
}
