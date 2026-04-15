import { useState, useEffect } from "react"

const MODES = {
  none: {},
  focus: { "--sidebar-display": "none", "--animation-duration": "0s" },
  dyslexia: { "--font-family": "Arial, sans-serif", "--line-height": "1.8", "--letter-spacing": "0.05em" },
  lowStimulation: { "--filter": "grayscale(100%)", "--animation-duration": "0s" },
}

export function useAccessibilityMode() {
  const [mode, setMode] = useState(() => localStorage.getItem("a11y-mode") || "none")

  useEffect(() => {
    const vars = MODES[mode] || {}
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
    Object.keys(MODES).forEach((m) => document.body.classList.remove(`mode-${m}`))
    document.body.classList.add(`mode-${mode}`)
    localStorage.setItem("a11y-mode", mode)
  }, [mode])

  return { mode, setMode, modes: Object.keys(MODES) }
}
