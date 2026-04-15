import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { parseCommand } from "../utils/commandParser"

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const results = parseCommand(query)

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen((o) => !o) }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => { if (open) { setQuery(""); setSelected(0); setTimeout(() => inputRef.current?.focus(), 50) } }, [open])

  const handleKey = (e) => {
    if (e.key === "ArrowDown") setSelected((s) => Math.min(s + 1, results.length - 1))
    if (e.key === "ArrowUp") setSelected((s) => Math.max(s - 1, 0))
    if (e.key === "Enter" && results[selected]) { results[selected].action(); setOpen(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
            initial={{ scale: 0.95, y: -10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-4 py-3 border-b border-gray-100">
              <span className="text-gray-400 mr-2">⌘</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
                onKeyDown={handleKey}
                placeholder="Search commands..."
                className="flex-1 outline-none text-gray-800 text-sm placeholder-gray-400"
              />
              <kbd className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">ESC</kbd>
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">No commands found</li>}
              {results.map((cmd, i) => (
                <li
                  key={cmd.id}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between ${i === selected ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`}
                  onClick={() => { cmd.action(); setOpen(false) }}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span>{cmd.label}</span>
                  {i === selected && <span className="text-xs text-blue-400">↵ Enter</span>}
                </li>
              ))}
            </ul>
            <div className="px-4 py-2 border-t border-gray-50 flex gap-3 text-xs text-gray-400">
              <span>↑↓ navigate</span><span>↵ select</span><span>ESC close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
