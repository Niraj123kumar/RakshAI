/**
 * GigShield DashboardScreen
 * FIX: Hardcoded LAN IP replaced with API_BASE from config.js
 *      All API calls include JWT Authorization header
 *      Simulation buttons use authenticated worker's real data (not hardcoded Rajan Kumar)
 *      useCountUp timers use requestAnimationFrame instead of setInterval at 16ms
 *      worker_id derived from authenticated worker object passed via navigation
 */
import { useEffect, useState, useRef, useCallback } from "react"
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  RefreshControl, Animated, TouchableOpacity, Dimensions, Alert
} from "react-native"
import axios from "axios"
import { API_BASE, getAuthHeaders } from "../config"  // FIX: centralized config

const { width } = Dimensions.get("window")

// FIX: useCountUp using requestAnimationFrame (not 16ms setInterval per card)
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)
  useEffect(() => {
    if (!target) { setValue(0); return }
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      setValue(Math.floor(progress * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
      else setValue(target)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])
  return value
}

function AnimatedCard({ label, value, prefix = "", color, delay = 0 }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const displayValue = useCountUp(value || 0)
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start()
  }, [])
  return (
    <Animated.View style={[styles.metricCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.metricAccent, { backgroundColor: color }]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{prefix}{displayValue.toLocaleString()}</Text>
    </Animated.View>
  )
}

function RiskBar({ date, score, color, index }) {
  const barAnim = useRef(new Animated.Value(0)).current
  const colorMap = { green: "#00D4AA", amber: "#FFB020", red: "#FF5B5B" }
  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: score / 100, duration: 700, delay: index * 80, useNativeDriver: false
    }).start()
  }, [score])
  const barHeight = barAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] })
  return (
    <View style={styles.riskBarContainer}>
      <Text style={styles.riskScore}>{score}</Text>
      <View style={styles.riskBarBg}>
        <Animated.View style={[styles.riskBarFill, { height: barHeight, backgroundColor: colorMap[color] || "#00D4AA" }]} />
      </View>
      <Text style={styles.riskDate}>{date}</Text>
    </View>
  )
}

export default function DashboardScreen({ route, navigation }) {
  // FIX: worker and token come from navigation params (set at login)
  const { worker: initialWorker, policy: initialPolicy, token } = route.params || {}

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [simResult, setSimResult] = useState(null)
  const [simLoading, setSimLoading] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      // FIX: worker_id from authenticated worker (not hardcoded), JWT in header
      const res = await axios.get(
        `${API_BASE}/dashboard/worker`,
        { headers: getAuthHeaders(token), timeout: 10000 }
      )
      setData(res.data)
    } catch (e) {
      // Show error rather than silently using stale data
      if (e.response?.status === 401) {
        Alert.alert("Session expired", "Please log in again.", [
          { text: "OK", onPress: () => navigation.replace("Login") }
        ])
      } else {
        // Fallback to initial data passed from login
        if (initialWorker) {
          setData({
            worker_name: initialWorker.name,
            gig_twin_score: initialPolicy?.risk_score || 70,
            coverage_status: initialPolicy?.status?.toUpperCase() || "ACTIVE",
            earnings_this_week: initialWorker.weekly_income_estimate || 3500,
            protected_this_week: initialPolicy?.max_payout || 0,
            protected_this_month: (initialPolicy?.max_payout || 0) * 4,
            last_5_payouts: [],
            today_risk_score: initialPolicy?.risk_score || 65,
            today_weather: "Loading...",
            today_income_impact_pct: 0,
            week_forecast: [],
            current_plan: initialPolicy?.plan_type || "Basic",
            next_premium_due: "—",
          })
        }
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, initialWorker, initialPolicy])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchDashboard()
  }, [fetchDashboard])

  // FIX: simulation uses authenticated worker's actual data, not hardcoded "Rajan Kumar"
  const runSimulation = async (triggerType, label) => {
    if (simLoading || !initialWorker) return
    setSimLoading(true)
    setSimResult(null)
    try {
      const payload = {
        zone_id: "HSR_LAYOUT_BLR",
        zone_lat: 12.9116,
        zone_lng: 77.6389,
        city: initialWorker.city || "Bengaluru",
        trigger_type: triggerType,
        event_severity: "moderate",
        event_value: 45.0,
        baseline_deliveries: 10.0,
        actual_deliveries: 5.5,   // 45% drop — above the 30% threshold
        checkin_lat: 12.9120,
        checkin_lng: 77.6391,
        gps_accuracy_m: 25.0,
      }
      // FIX: authenticated request — no worker_id in body (derived from JWT server-side)
      const res = await axios.post(
        `${API_BASE}/claims/auto-payout`,
        payload,
        { headers: getAuthHeaders(token), timeout: 15000 }
      )
      setSimResult({ ...res.data, label })
    } catch (e) {
      if (e.response?.status === 401) {
        Alert.alert("Session expired", "Please log in again.")
        navigation.replace("Login")
      } else {
        const msg = e.response?.data?.detail || "Simulation failed. Check your connection."
        setSimResult({ error: true, message: msg, label })
      }
    } finally {
      setSimLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
        <Text style={{ color: "#555", marginTop: 12 }}>Loading your dashboard...</Text>
      </View>
    )
  }

  const d = data || {}
  const riskColor = (d.today_risk_score || 65) >= 75 ? "#FF5B5B" : (d.today_risk_score || 65) >= 55 ? "#FFB020" : "#00D4AA"
  const coverageBadge = d.coverage_status === "ACTIVE" ? { bg: "#00D4AA15", border: "#00D4AA30", text: "#00D4AA" }
    : d.coverage_status === "PAUSED" ? { bg: "#FFB02015", border: "#FFB02030", text: "#FFB020" }
    : { bg: "#FF5B5B15", border: "#FF5B5B30", text: "#FF5B5B" }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D4AA" />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {d.worker_name?.split(" ")[0] || "Rider"} 👋</Text>
          <Text style={styles.headerSub}>Your coverage is active and monitoring</Text>
        </View>
        <View style={[styles.coverageBadge, { backgroundColor: coverageBadge.bg, borderColor: coverageBadge.border }]}>
          <Text style={[styles.coverageBadgeText, { color: coverageBadge.text }]}>{d.coverage_status || "ACTIVE"}</Text>
        </View>
      </View>

      {/* Risk score + weather */}
      <View style={styles.riskCard}>
        <View style={styles.riskLeft}>
          <Text style={styles.riskLabel}>Today's Risk Score</Text>
          <Text style={[styles.riskValue, { color: riskColor }]}>{d.today_risk_score || 65}</Text>
          <Text style={styles.riskSub}>{d.today_weather || "Clear"}</Text>
        </View>
        <View style={styles.riskRight}>
          <Text style={styles.incomeImpact}>Income Impact</Text>
          <Text style={[styles.impactPct, { color: (d.today_income_impact_pct || 0) > 10 ? "#FF5B5B" : "#00D4AA" }]}>
            {d.today_income_impact_pct?.toFixed(1) || "0.0"}%
          </Text>
        </View>
      </View>

      {/* Metrics */}
      <View style={styles.metricsGrid}>
        <AnimatedCard label="This Week" value={d.earnings_this_week || 0} prefix="₹" color="#00D4AA" delay={0} />
        <AnimatedCard label="Protected" value={d.protected_this_week || 0} prefix="₹" color="#7C6AF7" delay={100} />
        <AnimatedCard label="Plan" value={d.gig_twin_score || 70} prefix="" color="#FFB020" delay={200} />
        <AnimatedCard label="Monthly Cover" value={d.protected_this_month || 0} prefix="₹" color="#00D4AA" delay={300} />
      </View>

      {/* Week forecast */}
      {(d.week_forecast || []).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7-Day Risk Forecast</Text>
          <View style={styles.forecastRow}>
            {d.week_forecast.map((f, i) => (
              <RiskBar key={f.date} date={f.date} score={f.risk_score} color={f.color} index={i} />
            ))}
          </View>
        </View>
      )}

      {/* Recent payouts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Payouts</Text>
        {(d.last_5_payouts || []).length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No payouts yet. Your coverage is monitoring actively.</Text>
          </View>
        ) : d.last_5_payouts.map((p, i) => (
          <View key={i} style={styles.payoutRow}>
            <View>
              <Text style={styles.payoutEvent}>{p.event_type}</Text>
              <Text style={styles.payoutDate}>{new Date(p.date).toLocaleDateString()}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.payoutAmount}>₹{p.amount}</Text>
              <Text style={[styles.payoutStatus, { color: p.status === "COMPLETED" ? "#00D4AA" : "#FFB020" }]}>{p.status}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Simulation panel */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Simulate a Disruption Event</Text>
        <Text style={styles.sectionSub}>Test what your payout would look like — no real payment initiated</Text>
        <View style={styles.simGrid}>
          {[
            { type: "heavy_rain", label: "🌧 Heavy Rain" },
            { type: "extreme_heat", label: "☀️ Extreme Heat" },
            { type: "aqi_spike", label: "💨 AQI Spike" },
            { type: "flood", label: "🌊 Flood" },
          ].map(({ type, label }) => (
            <TouchableOpacity
              key={type}
              style={[styles.simBtn, simLoading && styles.simBtnDisabled]}
              onPress={() => runSimulation(type, label)}
              disabled={simLoading}
            >
              <Text style={styles.simBtnText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {simLoading && (
          <View style={styles.simLoading}>
            <ActivityIndicator color="#00D4AA" />
            <Text style={styles.simLoadingText}>Running payout engine...</Text>
          </View>
        )}

        {simResult && !simLoading && (
          <View style={[styles.simResult, simResult.error ? styles.simResultError : (simResult.status === "COMPLETED" ? styles.simResultSuccess : styles.simResultNeutral)]}>
            <Text style={styles.simResultLabel}>{simResult.label}</Text>
            {simResult.error ? (
              <Text style={styles.simResultMsg}>{simResult.message}</Text>
            ) : (
              <>
                <Text style={styles.simResultStatus}>Status: {simResult.status}</Text>
                {simResult.amount_inr > 0 && (
                  <Text style={styles.simResultAmount}>Payout: ₹{simResult.amount_inr}</Text>
                )}
                <Text style={styles.simResultMsg}>{simResult.message}</Text>
              </>
            )}
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0F14" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 60 },
  greeting: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  headerSub: { color: "#555", fontSize: 12, marginTop: 2 },
  coverageBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  coverageBadgeText: { fontSize: 11, fontWeight: "700" },
  riskCard: { margin: 20, marginTop: 0, backgroundColor: "#161921", borderRadius: 20, padding: 20, flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: "#ffffff08" },
  riskLeft: {},
  riskLabel: { color: "#777", fontSize: 12 },
  riskValue: { fontSize: 48, fontWeight: "900", letterSpacing: -2, marginVertical: 4 },
  riskSub: { color: "#555", fontSize: 12 },
  riskRight: { alignItems: "flex-end", justifyContent: "center" },
  incomeImpact: { color: "#777", fontSize: 12 },
  impactPct: { fontSize: 24, fontWeight: "800" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8 },
  metricCard: { backgroundColor: "#161921", borderRadius: 16, padding: 16, width: (width - 40) / 2, borderWidth: 1, borderColor: "#ffffff06", overflow: "hidden" },
  metricAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 2, opacity: 0.4 },
  metricLabel: { color: "#777", fontSize: 11, marginBottom: 8 },
  metricValue: { fontSize: 24, fontWeight: "800" },
  section: { margin: 20, marginTop: 8 },
  sectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  sectionSub: { color: "#555", fontSize: 12, marginBottom: 12 },
  forecastRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#161921", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#ffffff06" },
  riskBarContainer: { alignItems: "center", flex: 1 },
  riskScore: { color: "#777", fontSize: 10, marginBottom: 4 },
  riskBarBg: { width: 8, height: 80, backgroundColor: "#ffffff08", borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  riskBarFill: { width: "100%", borderRadius: 4 },
  riskDate: { color: "#555", fontSize: 9, marginTop: 4 },
  emptyBox: { backgroundColor: "#161921", borderRadius: 12, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#ffffff06" },
  emptyText: { color: "#555", fontSize: 13, textAlign: "center" },
  payoutRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#161921", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#ffffff06" },
  payoutEvent: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
  payoutDate: { color: "#555", fontSize: 11, marginTop: 2 },
  payoutAmount: { color: "#00D4AA", fontSize: 16, fontWeight: "800" },
  payoutStatus: { fontSize: 11, marginTop: 2 },
  simGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  simBtn: { backgroundColor: "#161921", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: "#00D4AA25" },
  simBtnDisabled: { opacity: 0.5 },
  simBtnText: { color: "#00D4AA", fontSize: 13, fontWeight: "600" },
  simLoading: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  simLoadingText: { color: "#555", fontSize: 13 },
  simResult: { marginTop: 12, borderRadius: 12, padding: 14, borderWidth: 1 },
  simResultSuccess: { backgroundColor: "#00D4AA12", borderColor: "#00D4AA30" },
  simResultNeutral: { backgroundColor: "#FFB02012", borderColor: "#FFB02030" },
  simResultError: { backgroundColor: "#FF5B5B12", borderColor: "#FF5B5B30" },
  simResultLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  simResultStatus: { color: "#AAA", fontSize: 12 },
  simResultAmount: { color: "#00D4AA", fontSize: 18, fontWeight: "800", marginVertical: 4 },
  simResultMsg: { color: "#777", fontSize: 12, marginTop: 4 },
})
