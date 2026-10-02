import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLocation, useNavigate } from "react-router-dom"
import MaterialIcon from "./MaterialIcon.jsx"
import { TOUR_STEPS } from "../lib/tour.js"

const GAP = 16
const MARGIN = 16
const RETRY_MS = 90
const RETRY_LIMIT = 60
const CARD_W = 380
const BAND_RATIO = 0.62
const EPSILON = 0.5
const MASK_ID = "fs-tour-spotlight-mask"

function findEl(selector) {
  if (!selector) return null
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}

/** Viewport-clipped rect so off-screen parts of a tall target don't punch a hole past the canvas. */
function toRect(el) {
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.max(0, Math.min(r.left, vw))
  const top = Math.max(0, Math.min(r.top, vh))
  const width = Math.max(0, Math.min(r.right, vw) - left)
  const visible = Math.max(0, Math.min(r.bottom, vh) - top)
  // Only a target that genuinely overflows the viewport gets banded; one that
  // simply fills most of the screen is still worth outlining in full.
  const band = vh * BAND_RATIO
  if (r.height > vh && visible > band) return { left, top: top + (visible - band) / 2, width, height: band }
  return { left, top, width, height: visible }
}

function collectRects(step) {
  const main = findEl(step.target)
  if (!main) return null
  const extra = (step.also || []).map(findEl).filter(Boolean).map(toRect)
  return { main: toRect(main), extra }
}

function sameRects(a, b) {
  if (!a || !b) return a === b
  if (a.extra.length !== b.extra.length) return false
  const same = (x, y) =>
    Math.abs(x.left - y.left) < EPSILON &&
    Math.abs(x.top - y.top) < EPSILON &&
    Math.abs(x.width - y.width) < EPSILON &&
    Math.abs(x.height - y.height) < EPSILON
  return same(a.main, b.main) && a.extra.every((r, i) => same(r, b.extra[i]))
}

function placeCard(rect, box) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(box.w, vw - MARGIN * 2)
  const h = Math.min(box.h, vh - MARGIN * 2)
  if (!rect) {
    return { left: (vw - w) / 2, top: vh - h - MARGIN - 8, width: w, placement: "center" }
  }
  let left = rect.left + rect.width / 2 - w / 2
  left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - w - MARGIN))
  const below = rect.top + rect.height + GAP
  const above = rect.top - GAP - h
  let top
  let placement
  if (below + h + MARGIN <= vh) {
    top = below
    placement = "below"
  } else if (above >= MARGIN) {
    top = above
    placement = "above"
  } else {
    top = Math.min(Math.max(rect.top, MARGIN), Math.max(MARGIN, vh - h - MARGIN))
    placement = "center"
  }
  return { left, top, width: w, placement }
}

/**
 * Scrim with a real cut-out hole plus a ring on every highlighted element.
 * The hole is an SVG mask so the highlighted element stays fully legible.
 */
function Spotlight({ rects, dimmed }) {
  const holes = rects
    ? [rects.main, ...rects.extra].filter((r) => r.width > 1 && r.height > 1)
    : []

  return (
    <>
      <div aria-hidden="true" className={`fixed inset-0 z-[95] ${dimmed ? "bg-on-background/25" : ""}`}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" height="100%" width="100%">
          <defs>
            <mask id={MASK_ID}>
              <rect fill="#fff" height="100%" width="100%" x="0" y="0" />
              {holes.map((r, i) => (
                <rect
                  fill="#000"
                  height={r.height}
                  key={i}
                  rx="14"
                  ry="14"
                  width={r.width}
                  x={r.left}
                  y={r.top}
                />
              ))}
            </mask>
          </defs>
          <rect
            fill="var(--color-tour-scrim)"
            height="100%"
            mask={`url(#${MASK_ID})`}
            width="100%"
            x="0"
            y="0"
          />
        </svg>
      </div>

      {holes.map((r, i) => (
        <div
          className="fixed z-[96] rounded-[14px] ring-2 ring-primary pointer-events-none transition-[left,top,width,height] duration-300 ease-out"
          key={i}
          style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
        />
      ))}
    </>
  )
}

function Walkthrough({ index, onStep, onExit }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [rects, setRects] = useState(null)
  const [cardBox, setCardBox] = useState({ w: CARD_W, h: 240 })
  const [pending, setPending] = useState(null)
  const cardRef = useRef(null)

  const step = TOUR_STEPS[index] || null
  const total = TOUR_STEPS.length
  // Path the tour is intentionally heading to, so our own navigation is not
  // mistaken for the analyst wandering off mid-tour.
  const enRouteTo = useRef(null)
  // True once we have actually landed on the current step's route. The
  // stray-navigation guard is meaningless (and racy) before then.
  const landed = useRef(false)

  const sync = useCallback(() => {
    if (!step) return
    setRects((prev) => {
      const next = collectRects(step)
      return sameRects(prev, next) ? prev : next
    })
  }, [step])

  // Each step declares the route it describes. Navigate there when the step
  // changes so the tour can be started from anywhere (e.g. the Admin console)
  // without the spotlight hunting for an anchor on the wrong page. Keyed on the
  // step id so it fires on our own advances only, never on manual navigation.
  const stepKey = step?.id
  useEffect(() => {
    if (!step) return
    landed.current = false
    enRouteTo.current = null
    if (location.pathname !== step.path) {
      enRouteTo.current = step.path
      navigate(step.path)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey])

  // If the analyst navigates somewhere the current step does not describe, the
  // card would be left describing a page they are no longer on. Close instead.
  useEffect(() => {
    if (!step) return
    if (location.pathname === step.path) {
      landed.current = true
      enRouteTo.current = null
      return
    }
    // Still travelling to the step's own route — not a stray navigation.
    if (!landed.current) return
    onExit()
  }, [location.pathname, step, onExit])

  // Locked before measuring so removing the scrollbar can't shift the target
  // rect out from under the spotlight. Held off until the anchor is actually
  // located, so a missing target can never trap the user behind a scrim.
  useEffect(() => {
    if (index == null || !rects) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [index, rects])

  // Page routes are lazy-loaded, so the anchor may not exist on the first frames
  // after a navigation. Poll briefly, then centre it and measure.
  useEffect(() => {
    if (!step) return
    let cancelled = false
    const timers = []
    let tries = 0
    setRects(null)

    const attempt = () => {
      if (cancelled) return
      const el = findEl(step.target)
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "instant" })
        // Pages enter with a 0.4s translateY animation, so the first frame's
        // rect is stale. Re-measure as it settles.
        for (const delay of [0, 120, 280, 500]) {
          timers.push(window.setTimeout(() => {
            if (!cancelled) setRects((prev) => {
              const next = collectRects(step)
              return sameRects(prev, next) ? prev : next
            })
          }, delay))
        }
        return
      }
      if (tries < RETRY_LIMIT) {
        tries += 1
        timers.push(window.setTimeout(attempt, RETRY_MS))
      }
    }

    attempt()
    return () => {
      cancelled = true
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [step, location.pathname])

  useEffect(() => {
    if (!step) return
    const onReflow = () => sync()
    window.addEventListener("resize", onReflow)
    window.addEventListener("scroll", onReflow, true)
    return () => {
      window.removeEventListener("resize", onReflow)
      window.removeEventListener("scroll", onReflow, true)
    }
  }, [step, sync])

  useEffect(() => {
    if (!step) return
    const onKey = (e) => {
      // A text field owns its own arrow keys — the ⌘K palette is z-indexed
      // below this scrim, so without this the arrows drive both at once.
      const t = e.target
      if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if (e.key === "Escape") onExit()
      if (e.key === "ArrowRight") advance()
      if (e.key === "ArrowLeft" && index > 0) rewind()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCardBox((prev) =>
      Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1
        ? prev
        : { w: r.width, h: r.height }
    )
  }, [index, location.pathname, step])

  function advance() {
    if (index >= total - 1) {
      onExit()
      return
    }
    goTo(index + 1)
  }

  function rewind() {
    if (index > 0) goTo(index - 1)
  }

  function goTo(nextIndex) {
    const next = TOUR_STEPS[nextIndex]
    if (!next) return
    if (next.path === location.pathname) {
      onStep(nextIndex)
      return
    }
    setPending({ index: nextIndex, path: next.path })
    navigate(next.path)
  }

  useEffect(() => {
    if (!pending || location.pathname !== pending.path) return
    const { index: nextIndex } = pending
    setPending(null)
    onStep(nextIndex)
  }, [pending, location.pathname, onStep])

  if (index == null || !step) return null

  const pos = placeCard(rects?.main, cardBox)
  const isLast = index >= total - 1

  return createPortal(
    <div aria-label="Guided tour" className="fixed inset-0 z-[95]" role="region">
      <Spotlight dimmed={!rects} rects={rects} />

      <div
        aria-labelledby="fs-tour-step-title"
        className="fixed z-[97] bg-surface-container-lowest rounded-2xl shadow-2xl ring-1 ring-outline-variant overflow-hidden flex flex-col animate-page-in"
        key={step.id}
        ref={cardRef}
        role="dialog"
        style={{ left: pos.left, top: pos.top, width: pos.width, maxWidth: "calc(100vw - 2rem)" }}
      >
        <div className="px-space-lg pt-space-lg pb-space-md flex items-start gap-space-md">
          <div className="w-9 h-9 rounded-lg bg-primary-fixed text-primary flex items-center justify-center shrink-0">
            <MaterialIcon name={step.icon} className="text-[20px]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-semibold">
              {step.eyebrow}
            </span>
            <h2
              className="font-headline-sm text-headline-sm text-on-surface leading-snug"
              id="fs-tour-step-title"
            >
              {step.title}
            </h2>
          </div>
          <button
            aria-label="Exit guided tour"
            className="p-1 -mr-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer shrink-0"
            onClick={onExit}
            type="button"
          >
            <MaterialIcon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="px-space-lg pb-space-lg">
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {step.body}
          </p>
        </div>

        <div className="h-1 w-full bg-surface-container-high">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>

        <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between gap-space-sm">
          <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant tabular-nums">
            {index + 1} / {total}
          </span>
          <div className="flex items-center gap-space-xs">
            <button
              className="px-space-md py-2 rounded-lg font-label-sm text-label-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
              onClick={onExit}
              type="button"
            >
              Skip tour
            </button>
            {index > 0 && (
              <button
                className="px-space-md py-2 rounded-lg bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-semibold shadow-sm hover:bg-surface-container-high transition-colors cursor-pointer"
                onClick={rewind}
                type="button"
              >
                Back
              </button>
            )}
            <button
              className="flex items-center gap-1.5 px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm font-semibold shadow-sm hover:bg-primary-container transition-colors cursor-pointer"
              onClick={advance}
              type="button"
            >
              <span>{isLast ? "Finish" : "Next"}</span>
              <MaterialIcon name={isLast ? "done_all" : "arrow_forward"} className="text-[16px]" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Walkthrough
