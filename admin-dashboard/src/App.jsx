import { useState, useEffect } from "react"
import axios from "axios"
import { motion } from "framer-motion"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Shield, AlertTriangle, TrendingUp, Users, DollarSign, Flag, Settings } from "lucide-react"
import AmbientBackground from "./components/AmbientBackground"
import CommandPalette from "./components/CommandPalette"
import { useAccessibilityMode } from "./hooks/useAccessibilityMode"

const API = "http://127.0.0.1:8000"

function MetricCard({ title, value, subtitle, icon: Icon, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-xl ${color}`}><Icon size={18} className="text-white" /></div>
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </motion.div>
  )
}

export default function App() {
  const [metrics, setMetrics] = useState(null)
  const [fraudQueue, setFraudQueue] = useState([])
  const [triggerMsg, setTriggerMsg] = useState("")
  const { mode, setMode, modes } = useAccessibilityMode()

  useEffect(() => {
    axios.get(`${API}/admin/api/v1/admin/metrics`).then((r) => setMetrics(r.data)).catch(() => {})
    axios.get(`${API}/admin/api/v1/admin/fraud-queue`).then((r) => setFraudQueue(r.data)).catch(() => {})
  }, [])

  const handleTrigger = async (eventType) => {
    try {
      const res = await axios.post(`${API}/admin/api/v1/admin/demo/trigger-event`, { event_type: eventType, zone: "HSR Layout" })
      setTriggerMsg(res.data.message)
      setTimeout(() => setTriggerMsg(""), 3000)
    } catch {}
  }

  window.triggerDemo = handleTrigger

  const payoutData = [
    { day: "Mon", payouts: 4200 }, { day: "Tue", payouts: 6800 }, { day: "Wed", payouts: 3200 },
    { day: "Thu", payouts: 9100 }, { day: "Fri", payouts: 5400 }, { day: "Sat", payouts: 7200 }, { day: "Sun", payouts: 2100 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <AmbientBackground />
      <CommandPalette />

      <nav className="relative z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0">
        <div className="flex items-center gap-2">
          <Shield size={24} className="text-blue-600" />
          <span className="text-xl font-bold text-gray-800">GigShield</span>
          <span className="text-sm text-gray-400 ml-2">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <kbd className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded border border-gray-200">⌘K</kbd>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
            {modes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>Live
          </span>
        </div>
      </nav>

      <main className="relative z-10 px-8 py-6 max-w-7xl mx-auto">
        {triggerMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm">
            ✅ {triggerMsg}
          </motion.div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <MetricCard title="Active Policies" value={metrics?.total_active_policies ?? "—"} icon={Users} color="bg-blue-500" delay={0} />
          <MetricCard title="Weekly Premiums" value={metrics ? `₹${metrics.weekly_premium_collected.toLocaleString()}` : "—"} icon={DollarSign} color="bg-green-500" delay={0.05} />
          <MetricCard title="Payouts" value={metrics ? `₹${metrics.total_payouts_this_week.toLocaleString()}` : "—"} icon={TrendingUp} color="bg-orange-500" delay={0.1} />
          <MetricCard title="Loss Ratio" value={metrics ? `${(metrics.loss_ratio * 100).toFixed(0)}%` : "—"} subtitle="Target: 55-60%" icon={AlertTriangle} color="bg-purple-500" delay={0.15} />
          <MetricCard title="Fraud Flags" value={metrics?.fraud_flags_count ?? "—"} icon={Flag} color="bg-red-500" delay={0.2} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Weekly Payout Volume</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={payoutData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `₹${v}`} />
                <Bar dataKey="payouts" fill="#1A73E8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Zone Risk Overview</h2>
            <div className="space-y-3">
              {[
                { zone: "HSR Layout", risk: 80, color: "bg-red-500" },
                { zone: "Koramangala", risk: 72, color: "bg-orange-500" },
                { zone: "Lajpat Nagar", risk: 68, color: "bg-orange-400" },
                { zone: "Indiranagar", risk: 55, color: "bg-yellow-500" },
                { zone: "GK1", risk: 45, color: "bg-green-500" },
              ].map((z) => (
                <div key={z.zone} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-gray-600">{z.zone}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${z.risk}%` }} transition={{ delay: 0.4, duration: 0.8 }}
                      className={`h-2 rounded-full ${z.color}`} />
                  </div>
                  <div className="text-sm font-medium text-gray-700 w-8">{z.risk}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div id="fraud-queue" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Flag size={18} className="text-red-500" /> Fraud Queue
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b">
                <th className="pb-2">Worker</th><th className="pb-2">Zone</th><th className="pb-2">Event</th>
                <th className="pb-2">Drop %</th><th className="pb-2">Score</th><th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {fraudQueue.map((item) => (
                <tr key={item.claim_id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="py-3 font-medium">{item.worker_name}</td>
                  <td className="py-3 text-gray-500">{item.zone}</td>
                  <td className="py-3 text-gray-500">{item.event_type}</td>
                  <td className="py-3 text-red-500 font-medium">{item.drop_pct}%</td>
                  <td className="py-3"><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">{item.anomaly_score}</span></td>
                  <td className="py-3 flex gap-2">
                    <button className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-green-600 transition-colors">Approve</button>
                    <button className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-red-600 transition-colors">Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🎮 Demo Mode</h2>
          <div className="flex flex-wrap gap-2">
            {["rain", "flood", "bandh", "heat", "aqi"].map((e) => (
              <button key={e} onClick={() => handleTrigger(e)}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700 transition-colors capitalize">
                Trigger {e}
              </button>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  )
}
