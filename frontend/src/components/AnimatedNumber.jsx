import { useEffect, useRef, useState } from "react"

export default function AnimatedNumber({
  value,
  format = (v) => Math.round(v).toLocaleString("en-IN"),
  prefix = "",
  suffix = "",
  duration = 900,
  delay = 0,
  className = "",
}) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const target = Number(value || 0)
    let raf = rafRef.current
    let cancelled = false
    const t0 = performance.now() + delay
    const frame = (now) => {
      if (cancelled) return
      if (now < t0) {
        raf = requestAnimationFrame(frame)
        return
      }
      const p = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(target * eased)
      if (p < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    rafRef.current = raf
    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
    }
  }, [value, duration, delay])

  return (
    <span className={className}>
      {prefix}
      {format(display)}
      {suffix}
    </span>
  )
}