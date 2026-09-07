import { useState } from "react"
import MaterialIcon from "./MaterialIcon.jsx"
import { getTheme, setTheme } from "../lib/runtime.js"

export default function ThemeToggle({ className = "" }) {
  const [dark, setDark] = useState(() => getTheme() === "dark")

  return (
    <button
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={`relative w-9 h-8 rounded-lg flex items-center justify-center text-on-surface hover:bg-surface-container transition-all cursor-pointer overflow-hidden ${className}`}
      onClick={() => {
        const next = !dark
        setDark(next)
        setTheme(next ? "dark" : "light")
      }}
      title={dark ? "Light theme" : "Dark theme"}
      type="button"
    >
      <MaterialIcon
        name={dark ? "light_mode" : "dark_mode"}
        className="text-[18px] transition-transform duration-300"
      />
    </button>
  )
}