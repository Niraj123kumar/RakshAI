/**
 * GigShield PolicyScreen
 * FIX: worker_id from authenticated worker (not hardcoded 1)
 *      JWT token in all API calls
 *      Upgrade/pause/resume operate on authenticated worker's policy
 */
import { useState, useEffect, useCallback } from "react"
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl
} from "react-native"
import axios from "axios"
import { API_BASE, getAuthHeaders } from "../config"

const PLANS = [
  { type: "Basic", premium: 50, maxPayout: 500, color: "#7C6AF7", features: ["Heavy rain", "Extreme heat", "Flood alerts"] },
  { type: "Standard", premium: 75, maxPayout: 900, color: "#00D4AA", features: ["All Basic", "AQI spike", "Bandh coverage"] },
  { type: "Pro", premium: 100, maxPayout: 1500, color: "#FFB020", features: ["All Standard", "Priority payouts", "Extended hours"] },
]

export default function PolicyScreen({ route, navigation }) {
  const { worker, token } = route.params || {}
  const [policy, setPolicy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPolicy = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/policy/current`,
        { headers: getAuthHeaders(token), timeout: 10000 }
      )
      setPolicy(res.data)
    } catch (e) {
      if (e.response?.status === 401) {
        Alert.alert("Session expired", "Please log in again.", [
          { text: "OK", onPress: () => navigation.replace("Login") }
        ])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => { fetchPolicy() }, [fetchPolicy])

  const onRefresh = useCallback(() => { setRefreshing(true); fetchPolicy() }, [fetchPolicy])

  const handleUpgrade = async (planType) => {
    if (planType === policy?.plan_type) return
    Alert.alert(
      `Upgrade to ${planType}`,
      `Weekly premium will be ₹${PLANS.find(p => p.type === planType)?.premium}. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upgrade",
          onPress: async () => {
            setActionLoading(true)
            try {
              await axios.post(
                `${API_BASE}/policy/upgrade`,
                { new_plan: planType },
                { headers: getAuthHeaders(token), timeout: 10000 }
              )
              Alert.alert("✅ Upgraded!", `Your plan is now ${planType}.`)
              fetchPolicy()
            } catch (e) {
              Alert.alert("Error", e.response?.data?.detail || "Upgrade failed. Try again.")
            } finally {
              setActionLoading(false)
            }
          }
        }
      ]
    )
  }

  const handlePause = async () => {
    Alert.alert("Pause Coverage?", "No payouts will fire while paused.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Pause",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true)
          try {
            await axios.post(`${API_BASE}/policy/pause`, {}, { headers: getAuthHeaders(token) })
            fetchPolicy()
          } catch (e) {
            Alert.alert("Error", "Could not pause policy.")
          } finally {
            setActionLoading(false)
          }
        }
      }
    ])
  }

  const handleResume = async () => {
    setActionLoading(true)
    try {
      await axios.post(`${API_BASE}/policy/resume`, {}, { headers: getAuthHeaders(token) })
      fetchPolicy()
    } catch (e) {
      Alert.alert("Error", "Could not resume policy.")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    )
  }

  const currentPlanMeta = PLANS.find(p => p.type === policy?.plan_type) || PLANS[0]

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D4AA" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your Policy</Text>
        {policy && (
          <View style={[styles.statusBadge, { borderColor: policy.status === "active" ? "#00D4AA40" : "#FFB02040", backgroundColor: policy.status === "active" ? "#00D4AA15" : "#FFB02015" }]}>
            <Text style={[styles.statusText, { color: policy.status === "active" ? "#00D4AA" : "#FFB020" }]}>{policy.status?.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {policy && (
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>Current Plan</Text>
          <Text style={[styles.currentPlan, { color: currentPlanMeta.color }]}>{policy.plan_type}</Text>
          <View style={styles.currentStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>₹{policy.weekly_premium}</Text>
              <Text style={styles.statLabel}>Weekly Premium</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>₹{policy.max_payout}</Text>
              <Text style={styles.statLabel}>Max Weekly Payout</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{policy.risk_score}</Text>
              <Text style={styles.statLabel}>Risk Score</Text>
            </View>
          </View>

          {policy.status === "active" ? (
            <TouchableOpacity style={styles.pauseBtn} onPress={handlePause} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#FFB020" /> : <Text style={styles.pauseBtnText}>⏸ Pause Coverage</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.resumeBtn} onPress={handleResume} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#00D4AA" /> : <Text style={styles.resumeBtnText}>▶️ Resume Coverage</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Available Plans</Text>
      {PLANS.map(plan => (
        <TouchableOpacity
          key={plan.type}
          style={[styles.planCard, policy?.plan_type === plan.type && { borderColor: plan.color + "60" }]}
          onPress={() => handleUpgrade(plan.type)}
          disabled={actionLoading}
        >
          <View style={styles.planHeader}>
            <View>
              <Text style={[styles.planName, { color: plan.color }]}>{plan.type}</Text>
              <Text style={styles.planPremium}>₹{plan.premium}/week</Text>
            </View>
            <View style={styles.planRight}>
              <Text style={styles.planMax}>Up to ₹{plan.maxPayout}</Text>
              {policy?.plan_type === plan.type && (
                <Text style={[styles.currentTag, { color: plan.color }]}>Current</Text>
              )}
            </View>
          </View>
          {plan.features.map((f, i) => (
            <Text key={i} style={styles.planFeature}>• {f}</Text>
          ))}
        </TouchableOpacity>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0F14" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 60 },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700" },
  currentCard: { margin: 20, backgroundColor: "#161921", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#ffffff08" },
  currentLabel: { color: "#777", fontSize: 12, marginBottom: 4 },
  currentPlan: { fontSize: 32, fontWeight: "900" },
  currentStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, marginBottom: 16 },
  stat: { alignItems: "center" },
  statValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  statLabel: { color: "#555", fontSize: 10, marginTop: 2 },
  pauseBtn: { backgroundColor: "#FFB02015", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#FFB02030" },
  pauseBtnText: { color: "#FFB020", fontSize: 14, fontWeight: "700" },
  resumeBtn: { backgroundColor: "#00D4AA15", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#00D4AA30" },
  resumeBtnText: { color: "#00D4AA", fontSize: 14, fontWeight: "700" },
  sectionTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginLeft: 20, marginBottom: 12 },
  planCard: { margin: 20, marginTop: 0, marginBottom: 12, backgroundColor: "#161921", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#ffffff08" },
  planHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  planName: { fontSize: 20, fontWeight: "800" },
  planPremium: { color: "#777", fontSize: 13, marginTop: 2 },
  planRight: { alignItems: "flex-end" },
  planMax: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  currentTag: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  planFeature: { color: "#555", fontSize: 12, marginTop: 3 },
})
