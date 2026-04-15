/**
 * GigShield LoginScreen
 * FIX: Hardcoded LAN IP replaced with config.js API_BASE.
 *      JWT token stored in navigation params and passed to all subsequent screens.
 *      No hardcoded phone number fallbacks that reveal real user data.
 *      Loading state shown during API call to prevent double-taps.
 */
import { useState, useRef, useEffect } from "react"
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from "react-native"
import axios from "axios"
import { API_BASE } from "../config"   // FIX: no more hardcoded IP

const { width, height } = Dimensions.get("window")

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(40)).current
  const logoScale = useRef(new Animated.Value(0.8)).current
  const glowAnim = useRef(new Animated.Value(0)).current
  const shakeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start()
  }, [])

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] })

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }

  const handleLogin = async () => {
    if (loading) return  // FIX: prevent double-tap
    if (phone.length !== 10) {
      setError("Enter a valid 10-digit phone number")
      shakeError()
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await axios.post(
        `${API_BASE}/auth/login`,
        { phone },
        { timeout: 10000 }
      )
      const data = res.data

      if (data.status === "found") {
        // FIX: pass JWT token to all downstream screens
        navigation.replace("Main", {
          worker: data.worker,
          policy: data.policy,
          token: data.token,    // JWT for authenticated API calls
          phone,
        })
      } else if (data.status === "not_registered") {
        navigation.navigate("Onboarding", { phone })
      }
    } catch (e) {
      const msg = e.response?.data?.detail || "Network error. Check your connection."
      setError(msg)
      shakeError()
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <Animated.View style={[styles.blob1, { opacity: glowOpacity }]} />
      <Animated.View style={[styles.blob2, { opacity: glowOpacity }]} />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.logoArea, { transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>⬡</Text>
          </View>
          <Text style={styles.logoText}>GigShield</Text>
          <Text style={styles.logoSub}>AI Income Protection</Text>
        </Animated.View>

        <Animated.View style={[styles.tagBox, { transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.tagLine}>Every delivery.</Text>
          <Text style={[styles.tagLine, { color: "#00D4AA" }]}>We've got your back.</Text>
          <Text style={styles.tagSub}>Parametric income protection for Q-commerce riders</Text>
        </Animated.View>

        <Animated.View style={[styles.formCard, { transform: [{ translateY: slideAnim }, { translateX: shakeAnim }] }]}>
          <Text style={styles.formTitle}>Sign in</Text>
          <Text style={styles.formSub}>Enter your registered phone number</Text>

          <View style={[styles.phoneInput, error ? styles.phoneInputError : null]}>
            <View style={styles.countryCode}>
              <Text style={styles.countryText}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={t => {
                setPhone(t.replace(/\D/g, "").slice(0, 10))
                setError("")
              }}
              placeholder="9876543210"
              placeholderTextColor="#444"
              keyboardType="phone-pad"
              maxLength={10}
              editable={!loading}
            />
            {phone.length === 10 && (
              <View style={styles.checkMark}>
                <Text style={{ color: "#00D4AA", fontSize: 14 }}>✓</Text>
              </View>
            )}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.loginBtn, (loading || phone.length < 10) && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading || phone.length < 10}
          >
            {loading
              ? <ActivityIndicator color="#0D0F14" />
              : <Text style={styles.loginBtnText}>Continue →</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signupLink}
            onPress={() => navigation.navigate("Onboarding", { phone })}
            disabled={loading}
          >
            <Text style={styles.signupText}>
              New rider? <Text style={{ color: "#00D4AA", fontWeight: "700" }}>Sign up in 3 minutes</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.badges, { opacity: fadeAnim }]}>
          {["🔒 Secure", "⚡ Instant Payouts", "📱 No Documents"].map((b, i) => (
            <View key={i} style={styles.badge}>
              <Text style={styles.badgeText}>{b}</Text>
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0F14" },
  blob1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#00D4AA", top: -100, right: -100, transform: [{ scale: 1.5 }], opacity: 0.05 },
  blob2: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#7C6AF7", bottom: 100, left: -80, opacity: 0.07 },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: "center" },
  logoArea: { alignItems: "center", marginBottom: 32 },
  logoIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: "#00D4AA18", alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 1, borderColor: "#00D4AA33" },
  logoEmoji: { fontSize: 32, color: "#00D4AA" },
  logoText: { color: "#FFFFFF", fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  logoSub: { color: "#555", fontSize: 13, letterSpacing: 1, marginTop: 4 },
  tagBox: { marginBottom: 32, alignItems: "center" },
  tagLine: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", letterSpacing: -0.5, lineHeight: 32 },
  tagSub: { color: "#555", fontSize: 13, marginTop: 10, textAlign: "center", lineHeight: 20 },
  formCard: { backgroundColor: "#161921", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "#ffffff08", marginBottom: 24 },
  formTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginBottom: 4 },
  formSub: { color: "#777", fontSize: 13, marginBottom: 20 },
  phoneInput: { flexDirection: "row", backgroundColor: "#0D0F14", borderRadius: 14, borderWidth: 1, borderColor: "#ffffff10", overflow: "hidden", marginBottom: 12, alignItems: "center" },
  phoneInputError: { borderColor: "#FF5B5B55" },
  countryCode: { paddingHorizontal: 14, justifyContent: "center", borderRightWidth: 1, borderRightColor: "#ffffff10", paddingVertical: 14 },
  countryText: { color: "#FFFFFF", fontSize: 14 },
  input: { flex: 1, color: "#FFFFFF", fontSize: 16, padding: 14 },
  checkMark: { paddingRight: 14 },
  errorBox: { backgroundColor: "#FF5B5B12", borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#FF5B5B25" },
  errorText: { color: "#FF8080", fontSize: 13, lineHeight: 18 },
  loginBtn: { backgroundColor: "#00D4AA", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 14 },
  loginBtnDisabled: { backgroundColor: "#00D4AA55" },
  loginBtnText: { color: "#0D0F14", fontSize: 16, fontWeight: "700" },
  signupLink: { alignItems: "center" },
  signupText: { color: "#666", fontSize: 14 },
  badges: { flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  badge: { backgroundColor: "#161921", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#ffffff08" },
  badgeText: { color: "#666", fontSize: 11 },
})
