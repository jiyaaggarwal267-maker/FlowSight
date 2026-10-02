import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import ContextModal from "./ContextModal.jsx"
import Walkthrough from "./Walkthrough.jsx"
import { bus } from "../lib/runtime.js"
import { hasSeenContext, markContextSeen, TOUR_STEPS } from "../lib/tour.js"

function inWorkspace(pathname) {
  return (
    pathname === "/analyst" ||
    pathname.startsWith("/analyst/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  )
}

/**
 * Mounted outside the route Suspense boundary so the tour keeps its state while
 * lazy page chunks swap in and out between steps.
 */
function OnboardingLayer() {
  const location = useLocation()
  const [contextOpen, setContextOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(null)
  const offered = useRef(false)

  const closeContext = useCallback(() => {
    markContextSeen()
    setContextOpen(false)
  }, [])

  // First entry into the Analyst or Admin workspace each session.
  useEffect(() => {
    if (!inWorkspace(location.pathname)) {
      offered.current = false
      return
    }
    if (offered.current || hasSeenContext()) return
    offered.current = true
    setContextOpen(true)
  }, [location.pathname])

  useEffect(() => {
    const offContext = bus.on("open-context", () => setContextOpen(true))
    const offTour = bus.on("open-tour", (payload) => {
      setContextOpen(false)
      setStepIndex(Math.min(Math.max(payload?.stepIndex ?? 0, 0), TOUR_STEPS.length - 1))
    })
    return () => {
      offContext()
      offTour()
    }
  }, [])

  return (
    <>
      <ContextModal onClose={closeContext} open={contextOpen} />
      <Walkthrough index={stepIndex} onExit={() => setStepIndex(null)} onStep={setStepIndex} />
    </>
  )
}

export default OnboardingLayer