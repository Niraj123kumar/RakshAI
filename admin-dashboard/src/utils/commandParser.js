const COMMANDS = [
  { id: "metrics", label: "View Metrics", keywords: ["metrics", "overview", "stats", "dashboard"], action: () => window.scrollTo(0, 0) },
  { id: "fraud", label: "Open Fraud Queue", keywords: ["fraud", "queue", "review", "flags"], action: () => document.getElementById("fraud-queue")?.scrollIntoView() },
  { id: "demo-rain", label: "Trigger Rain Event", keywords: ["rain", "trigger", "demo", "event"], action: () => window.triggerDemo?.("rain") },
  { id: "demo-flood", label: "Trigger Flood Event", keywords: ["flood", "trigger", "demo"], action: () => window.triggerDemo?.("flood") },
  { id: "demo-aqi", label: "Trigger AQI Event", keywords: ["aqi", "air", "quality", "trigger"], action: () => window.triggerDemo?.("aqi") },
  { id: "dark", label: "Toggle Dark Mode", keywords: ["dark", "light", "theme", "mode"], action: () => document.documentElement.classList.toggle("dark") },
  { id: "focus", label: "Toggle Focus Mode", keywords: ["focus", "clean", "minimal"], action: () => document.body.classList.toggle("focus-mode") },
]

export function parseCommand(query) {
  if (!query.trim()) return COMMANDS
  const q = query.toLowerCase()
  return COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q))
  )
}

export { COMMANDS }
