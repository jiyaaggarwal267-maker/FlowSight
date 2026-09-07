import { useEffect, useState } from "react"

// oxlint-disable-next-line react/only-export-components
export function useDemoLoad(delay = 700) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), delay)
    return () => clearTimeout(t)
  }, [delay])
  return loading
}

export default function Skeleton({ className = "" }) {
  return <div className={`animate-shimmer rounded bg-surface-container-high ${className}`} />
}