import { useEffect } from "react"

export default function AmbientBackground() {
  useEffect(() => {
    const handler = (e) => {
      document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`)
      document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`)
    }
    window.addEventListener("mousemove", handler)
    return () => window.removeEventListener("mousemove", handler)
  }, [])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 transition-all duration-700"
      style={{
        background: "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(26,115,232,0.08), transparent 70%)",
      }}
    />
  )
}
