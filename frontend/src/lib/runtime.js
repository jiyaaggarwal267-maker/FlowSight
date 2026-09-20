const listeners = {}

export const bus = {
  on(name, fn) {
    ;(listeners[name] ||= []).push(fn)
    return () => bus.off(name, fn)
  },
  off(name, fn) {
    const list = listeners[name]
    if (list) listeners[name] = list.filter((f) => f !== fn)
  },
  emit(name, payload) {
    ;(listeners[name] || []).forEach((fn) => fn(payload))
  },
}

export const THEME_KEY = "flowsight-theme"

export const TTS_LANG_KEY = "flowsight_tts_lang"

export const TTS_LANGUAGES = {
  en: "English", hi: "Hindi", bgc: "Haryanvi", ta: "Tamil", te: "Telugu",
  mr: "Marathi", bn: "Bengali", gu: "Gujarati",
  kn: "Kannada", ml: "Malayalam", pa: "Punjabi",
}

export function getTtsLanguage() {
  try { return localStorage.getItem(TTS_LANG_KEY) || "en" } catch { return "en" }
}

export function persistTtsLanguage(code) {
  try { localStorage.setItem(TTS_LANG_KEY, code) } catch { /* storage unavailable */ }
}

export function getTheme() {
  if (typeof localStorage === "undefined") return "light"
  const stored = localStorage.getItem(THEME_KEY)
  return stored === "dark" ? "dark" : "light"
}

export function setTheme(theme) {
  const next = theme === "dark" ? "dark" : "light"
  if (typeof localStorage !== "undefined") localStorage.setItem(THEME_KEY, next)
  document.documentElement.setAttribute("data-theme", next)
  bus.emit("theme", next)
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark")
}

export function initTheme() {
  const theme = getTheme()
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", theme)
}

export function formatINR(value) {
  const n = Number(value || 0)
  return n.toLocaleString("en-IN")
}

export function formatCompactINR(value) {
  const n = Number(value || 0)
  if (n >= 1e7) {
    const v = n / 1e7
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} Cr`
  }
  if (n >= 1e5) {
    const v = n / 1e5
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} L`
  }
  return n.toLocaleString("en-IN")
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

function twoWords(n) {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t]
}

export function inrToWords(value) {
  let n = Math.round(Number(value) || 0)
  if (n <= 0) return "zero rupees"
  const parts = []
  for (const [name, scale] of [["crore", 1e7], ["lakh", 1e5], ["thousand", 1e3], ["hundred", 1e2]]) {
    if (n >= scale) {
      const q = Math.floor(n / scale)
      parts.push(`${twoWords(q)} ${name}`)
      n -= q * scale
    }
  }
  if (n > 0) parts.push(twoWords(n))
  return parts.length ? `${parts.join(" ")} rupees` : "zero rupees"
}

const NOTIFICATIONS = [
  {
    id: "notif-live-1",
    title: "High-risk alert escalated",
    body: "AC-20491 crossed 3X daily velocity. Assigned to INV-042.",
    tone: "error",
    time: "just now",
  },
  {
    id: "notif-live-2",
    title: "New layering pattern detected",
    body: "Two-hop UPI layering through Kotak flagged on 6 accounts.",
    tone: "primary",
    time: "2m ago",
  },
  {
    id: "notif-live-3",
    title: "Rule RF-14 dry-run complete",
    body: "14 potential hits · 3 confirmed mules. Review suggested.",
    tone: "secondary",
    time: "9m ago",
  },
]

let nextNotifId = 100

export function notify({ title, body, tone = "primary", time = "just now" }) {
  nextNotifId += 1
  const item = { id: `notif-live-${nextNotifId}`, title, body, tone, time }
  NOTIFICATIONS.unshift(item)
  if (NOTIFICATIONS.length > 8) NOTIFICATIONS.pop()
  bus.emit("notify", item)
  return item
}

export function getNotifications() {
  return NOTIFICATIONS
}

export function openPalette() {
  bus.emit("open-palette")
}