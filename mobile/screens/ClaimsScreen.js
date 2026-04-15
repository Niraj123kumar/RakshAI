/**
 * GigShield ClaimsScreen
 * FIX: Loads claims from the real database via authenticated API call.
 *      No more hardcoded MOCK_CLAIMS in the frontend.
 *      Uses JWT token from navigation params.
 */
import { useState, useEffect, useCallback } from "react"
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, Alert
} from "react-native"
import axios from "axios"
import { API_BASE, getAuthHeaders } from "../config"

export default function ClaimsScreen({ route, navigation }) {
  const { token } = route.params || {}
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const fetchClaims = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/claims/history`,
        { headers: getAuthHeaders(token), timeout: 10000 }
      )
      setClaims(res.data.claims || [])
      setError("")
    } catch (e) {
      if (e.response?.status === 401) {
        Alert.alert("Session expired", "Please log in again.", [
          { text: "OK", onPress: () => navigation.replace("Login") }
        ])
      } else {
        setError("Could not load claims. Pull down to retry.")
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => { fetchClaims() }, [fetchClaims])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchClaims()
  }, [fetchClaims])

  const statusColor = (s) => {
    if (s === "COMPLETED") return "#00D4AA"
    if (s === "MANUAL_REVIEW") return "#FFB020"
    if (s === "REJECTED" || s === "SUSPENDED") return "#FF5B5B"
    return "#777"
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D4AA" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Claim History</Text>
        <Text style={styles.sub}>All payouts associated with your policy</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {claims.length === 0 && !error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🛡</Text>
          <Text style={styles.emptyTitle}>No claims yet</Text>
          <Text style={styles.emptyText}>
            When a disruption event triggers a payout, it will appear here automatically.
          </Text>
        </View>
      ) : null}

      {claims.map((claim) => (
        <View key={claim.claim_id} style={styles.claimCard}>
          <View style={styles.claimTop}>
            <View style={[styles.statusBadge, { borderColor: statusColor(claim.status) + "40", backgroundColor: statusColor(claim.status) + "15" }]}>
              <Text style={[styles.statusText, { color: statusColor(claim.status) }]}>{claim.status}</Text>
            </View>
            {claim.payout_amount != null && claim.payout_amount > 0 && (
              <Text style={styles.payoutAmount}>₹{claim.payout_amount}</Text>
            )}
          </View>
          <Text style={styles.claimId}>Claim #{claim.claim_id}</Text>
          <Text style={styles.claimDate}>{new Date(claim.created_at).toLocaleString()}</Text>
          <Text style={styles.estimatedLoss}>Estimated loss: ₹{claim.estimated_loss?.toFixed(0)}</Text>
          {claim.fraud_check_results?.trigger_type && (
            <Text style={styles.triggerType}>Trigger: {claim.fraud_check_results.trigger_type.replace(/_/g, " ")}</Text>
          )}
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0F14" },
  header: { padding: 20, paddingTop: 60 },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  sub: { color: "#555", fontSize: 13, marginTop: 4 },
  errorBox: { margin: 20, backgroundColor: "#FF5B5B12", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#FF5B5B30" },
  errorText: { color: "#FF8080", fontSize: 13 },
  emptyBox: { margin: 20, backgroundColor: "#161921", borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 1, borderColor: "#ffffff06" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { color: "#555", fontSize: 13, textAlign: "center", lineHeight: 20 },
  claimCard: { margin: 20, marginTop: 0, marginBottom: 12, backgroundColor: "#161921", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#ffffff08" },
  claimTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700" },
  payoutAmount: { color: "#00D4AA", fontSize: 20, fontWeight: "800" },
  claimId: { color: "#777", fontSize: 12 },
  claimDate: { color: "#555", fontSize: 11, marginTop: 2 },
  estimatedLoss: { color: "#AAA", fontSize: 13, marginTop: 6 },
  triggerType: { color: "#777", fontSize: 12, marginTop: 2, textTransform: "capitalize" },
})
