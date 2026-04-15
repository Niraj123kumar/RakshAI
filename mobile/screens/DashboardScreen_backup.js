import { useEffect, useState, useRef } from "react"
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  RefreshControl, Animated, TouchableOpacity, Dimensions
} from "react-native"
import axios from "axios"

const API = "http://10.106.0.75:8000"
const { width } = Dimensions.get("window")

// Animated number counter hook
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setValue(target); clearInterval(timer) }
      else setValue(Math.floor(start))
    }, 16)
    
    
  };

  
  

  

  

  return () => clearInterval(timer)
  }, [target])
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

  
    
  };

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
  }, [])

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })

  
    
  };

  return (
    <View style={styles.riskRow}>
      <Text style={styles.riskDay}>{date}</Text>
      <View style={styles.riskBarBg}>
        <Animated.View style={[styles.riskBarFill, { width: barWidth, backgroundColor: colorMap[color] }]} />
      
<View style={{ marginTop: 30 }}>
</View>

</View>
      <View style={[styles.riskBadge, { backgroundColor: colorMap[color] + "22" }]}>
        <Text style={[styles.riskScore, { color: colorMap[color] }]}>{score}</Text>
      </View>
    </View>
  )
}

function PayoutRow({ payout, index }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 60, useNativeDriver: true }).start()
  }, [])
  const isPaid = payout.status === "PAID"

  
    
  };

  return (
    <Animated.View style={[styles.payoutRow, { opacity: fadeAnim }]}>
      <View style={[styles.payoutIcon, { backgroundColor: isPaid ? "#00D4AA22" : "#FFB02022" }]}>
        <Text style={{ fontSize: 14 }}>{isPaid ? "✓" : "⏳"}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.payoutEvent}>{payout.event_type?.toUpperCase() || "DISRUPTION"}</Text>
        <Text style={styles.payoutDate}>{payout.date?.slice(0, 10)}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.payoutAmount}>₹{payout.amount?.toLocaleString()}</Text>
        <View style={[styles.statusPill, { backgroundColor: isPaid ? "#00D4AA22" : "#FFB02022" }]}>
          <Text style={[styles.statusText, { color: isPaid ? "#00D4AA" : "#FFB020" }]}>{payout.status}</Text>
        </View>
      </View>
    </Animated.View>
  )
}

export default function DashboardScreen({ route }) {
  const worker = route?.params?.worker
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const headerAnim = useRef(new Animated.Value(0)).current
  const scoreAnim = useRef(new Animated.Value(0)).current

  
  const simulatePandemic = async () => {
    await axios.post("http://10.106.0.75:8000/claims/auto-payout", {
      worker_id: "1",
      worker_name: "Rajan",
      zone_id: "HSR",
      zone_lat: 12.9,
      zone_lng: 77.6,
      city: "Bangalore",
      platform: "Zepto",
      shift_start: "14:00",
      shift_end: "20:00",
      weekly_income_estimate: 5500,
      registered_upi: "rajan@upi",
      plan_type: "standard",
      trigger_type: "pandemic",
      event_severity: "0.9",
      event_value: 350,
      baseline_deliveries: 20,
      actual_deliveries: 5
    });
    alert("❌ Rejected (Excluded)");
  };

  const simulateFraud = async () => {
    await axios.post("http://10.106.0.75:8000/claims/auto-payout", {
      worker_id: "1",
      worker_name: "Rajan",
      zone_id: "HSR",
      zone_lat: 12.9,
      zone_lng: 77.6,
      city: "Bangalore",
      platform: "Zepto",
      shift_start: "14:00",
      shift_end: "20:00",
      weekly_income_estimate: 5500,
      registered_upi: "rajan@upi",
      plan_type: "standard",
      trigger_type: "weather",
      event_severity: "0.2",
      event_value: 10,
      baseline_deliveries: 20,
      actual_deliveries: 2
    });
    alert("⚠️ Fraud flagged");
  };

  const simulatePayout = async () => {
    await axios.post("http://10.106.0.75:8000/claims/auto-payout", {
      worker_id: "1",
      worker_name: "Rajan",
      zone_id: "HSR",
      zone_lat: 12.9,
      zone_lng: 77.6,
      city: "Bangalore",
      platform: "Zepto",
      shift_start: "14:00",
      shift_end: "20:00",
      weekly_income_estimate: 5500,
      registered_upi: "rajan@upi",
      plan_type: "standard",
      trigger_type: "weather",
      event_severity: "0.9",
      event_value: 300,
      baseline_deliveries: 20,
      actual_deliveries: 15
    });
    alert("✅ ₹500 Paid");
  };


const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/worker?worker_id=${worker?.id || 1}`)
      setData(res.data)
      Animated.parallel([
        Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(scoreAnim, { toValue: 1, duration: 800, delay: 200, useNativeDriver: false }),
      ]).start()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#00D4AA" />
      <Text style={styles.loadingText}>Loading your dashboard...</Text>
    </View>
  )

  const coverageActive = data?.coverage_status === "ACTIVE"
  const riskScore = data?.today_risk_score || 0
  const riskColor = riskScore < 50 ? "#00D4AA" : riskScore < 75 ? "#FFB020" : "#FF5B5B"
  const circumference = 2 * Math.PI * 40

  
    
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData() }} tintColor="#00D4AA" />}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Header */}
      <Animated.View style={[styles.hero, { opacity: headerAnim }]}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroGreeting}>Good morning 👋</Text>
            <Text style={styles.heroName}>{data?.worker_name || worker?.name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: coverageActive ? "#00D4AA22" : "#FF5B5B22", borderColor: coverageActive ? "#00D4AA44" : "#FF5B5B44" }]}>
            <View style={[styles.statusDot, { backgroundColor: coverageActive ? "#00D4AA" : "#FF5B5B" }]} />
            <Text style={[styles.statusText, { color: coverageActive ? "#00D4AA" : "#FF5B5B" }]}>{data?.coverage_status}</Text>
          </View>
        </View>

        {/* Plan Card */}
        <View style={styles.planCard}>
          <View style={styles.planLeft}>
            <Text style={styles.planLabel}>Current Plan</Text>
            <Text style={styles.planName}>{data?.current_plan}</Text>
            <Text style={styles.planSub}>Next premium: {data?.next_premium_due}</Text>
          </View>
          {/* Risk Score Ring */}
          <View style={styles.riskRing}>
            <View style={styles.riskRingInner}>
              <Text style={[styles.riskRingValue, { color: riskColor }]}>{riskScore}</Text>
              <Text style={styles.riskRingLabel}>Risk</Text>
            </View>
            <View style={[styles.riskRingCircle, { borderColor: riskColor + "44" }]}>
              <View style={[styles.riskRingProgress, { borderColor: riskColor }]} />
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Metric Cards */}
      <View style={styles.metricsGrid}>
        <AnimatedCard label="Weekly Earnings" value={data?.earnings_this_week} prefix="₹" color="#00D4AA" delay={100} />
        <AnimatedCard label="Protected / Week" value={data?.protected_this_week} prefix="₹" color="#7C6AF7" delay={200} />
        <AnimatedCard label="Protected / Month" value={data?.protected_this_month} prefix="₹" color="#FFB020" delay={300} />
        <AnimatedCard label="Risk Score" value={data?.today_risk_score} color={riskColor} delay={400} />
      </View>

      {/* Weather Strip */}
      <View style={styles.weatherStrip}>
        <Text style={styles.weatherIcon}>🌤</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.weatherText}>{data?.today_weather}</Text>
          <Text style={styles.weatherSub}>{data?.today_income_impact_pct}% income impact today</Text>
        </View>
      </View>

      {/* Week Forecast */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Week Forecast</Text>
        <Text style={styles.sectionSub}>Risk levels for each day</Text>
        {data?.week_forecast?.map((d, i) => <RiskBar key={i} {...d} index={i} />)}
      </View>

      {/* Last Payouts */}
      <View style={[styles.section, { marginBottom: 32 }]}>
        <Text style={styles.sectionTitle}>Recent Payouts</Text>
        <Text style={styles.sectionSub}>Last {data?.last_5_payouts?.length} transactions</Text>
        {data?.last_5_payouts?.map((p, i) => <PayoutRow key={i} payout={p} index={i} />)}
      </View>
    
<View style={{ margin: 20 }}>
  <Button title="Simulate Pandemic ❌" onPress={simulatePandemic} />
  <View style={{ height: 10 }} />
  <Button title="Simulate Fraud ⚠️" onPress={simulateFraud} />
  <View style={{ height: 10 }} />
  <Button title="Simulate Rain 💰" onPress={simulatePayout} />
</View>

</ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0F14" },
  loadingContainer: { flex: 1, backgroundColor: "#0D0F14", alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { color: "#666", fontSize: 14 },

  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  heroGreeting: { color: "#666", fontSize: 13, marginBottom: 2 },
  heroName: { color: "#FFFFFF", fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },

  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },

  planCard: { backgroundColor: "#161921", borderRadius: 20, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#ffffff0a" },
  planLeft: { flex: 1 },
  planLabel: { color: "#666", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  planName: { color: "#FFFFFF", fontSize: 28, fontWeight: "700", letterSpacing: -1, marginBottom: 4 },
  planSub: { color: "#555", fontSize: 12 },

  riskRing: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  riskRingInner: { position: "absolute", alignItems: "center", justifyContent: "center", zIndex: 1 },
  riskRingValue: { fontSize: 20, fontWeight: "700" },
  riskRingLabel: { color: "#555", fontSize: 10, letterSpacing: 1 },
  riskRingCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 3 },
  riskRingProgress: { position: "absolute", width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderTopColor: "transparent", borderRightColor: "transparent" },

  metricsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, marginTop: 16 },
  metricCard: { backgroundColor: "#161921", borderRadius: 16, padding: 16, width: (width - 40) / 2, borderWidth: 1, borderColor: "#ffffff08", overflow: "hidden" },
  metricAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 2, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  metricLabel: { color: "#666", fontSize: 11, letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  metricValue: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },

  weatherStrip: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 16, backgroundColor: "#161921", borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: "#ffffff08" },
  weatherIcon: { fontSize: 28 },
  weatherText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  weatherSub: { color: "#666", fontSize: 12, marginTop: 2 },

  section: { backgroundColor: "#161921", marginHorizontal: 20, marginTop: 16, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#ffffff08" },
  sectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 2 },
  sectionSub: { color: "#555", fontSize: 12, marginBottom: 16 },

  riskRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  riskDay: { width: 32, color: "#666", fontSize: 12, fontWeight: "600" },
  riskBarBg: { flex: 1, height: 6, backgroundColor: "#ffffff0a", borderRadius: 3, overflow: "hidden" },
  riskBarFill: { height: 6, borderRadius: 3 },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  riskScore: { fontSize: 11, fontWeight: "700" },

  payoutRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#ffffff08" },
  payoutIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  payoutEvent: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  payoutDate: { color: "#555", fontSize: 11, marginTop: 2 },
  payoutAmount: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
})
