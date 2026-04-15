/**
 * GigShield Background Intelligence Service
 * FIX: Hardcoded LAN IP replaced with API_BASE from config.js
 *      GPS uploads use JWT Authorization header
 *      AsyncStorage GPS log has a max size cap to prevent unbounded growth
 */

import { useEffect, useRef, useState } from "react"
import * as Location from "expo-location"
import * as TaskManager from "expo-task-manager"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "axios"
import { API_BASE, getAuthHeaders } from "../config"  // FIX: centralized config

const GPS_TASK_NAME = "GIGSHIELD_GPS_BACKGROUND"
const GPS_LOG_KEY = "gigshield_gps_log"
const MAX_GPS_LOG_SIZE = 200  // FIX: cap log size to prevent unbounded AsyncStorage growth

// ── Background GPS Task ───────────────────────────────────────────────────────
TaskManager.defineTask(GPS_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn("[GigShield GPS] Background task error:", error)
    return
  }
  if (!data?.locations?.length) return

  const location = data.locations[0]
  const point = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy_m: location.coords.accuracy,
    timestamp: new Date(location.timestamp).toISOString(),
  }

  // Append to capped log in AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(GPS_LOG_KEY)
    const log = raw ? JSON.parse(raw) : []
    log.push(point)
    // FIX: evict oldest entries if over cap
    const trimmed = log.length > MAX_GPS_LOG_SIZE ? log.slice(-MAX_GPS_LOG_SIZE) : log
    await AsyncStorage.setItem(GPS_LOG_KEY, JSON.stringify(trimmed))
  } catch (e) {
    console.warn("[GigShield GPS] AsyncStorage error:", e)
  }
})


// ── Hook: Passive Intelligence ────────────────────────────────────────────────
export function usePassiveIntelligence({ token, workerId, shiftStart, shiftEnd }) {
  const [status, setStatus] = useState("idle")
  const uploadIntervalRef = useRef(null)

  useEffect(() => {
    if (!token || !workerId) return

    startBackgroundTracking()
    // FIX: upload GPS data every 10 minutes (not every background cycle)
    uploadIntervalRef.current = setInterval(() => uploadRecentGPS(token), 10 * 60 * 1000)

    return () => {
      if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current)
    }
  }, [token, workerId])

  const startBackgroundTracking = async () => {
    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync()
      if (fgStatus !== "granted") {
        console.log("[GigShield GPS] Foreground location permission denied")
        return
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync()
      if (bgStatus !== "granted") {
        console.log("[GigShield GPS] Background location permission denied — using foreground only")
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(GPS_TASK_NAME)
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10 * 60 * 1000,   // 10 minutes
          distanceInterval: 200,           // or 200m movement
          foregroundService: {
            notificationTitle: "GigShield",
            notificationBody: "Monitoring your zone for disruption events",
          },
          pausesUpdatesAutomatically: true,
          activityType: Location.ActivityType.AutomotiveNavigation,
        })
      }

      setStatus("tracking")
    } catch (e) {
      console.warn("[GigShield GPS] Failed to start background tracking:", e)
      setStatus("error")
    }
  }

  const uploadRecentGPS = async (authToken) => {
    try {
      const raw = await AsyncStorage.getItem(GPS_LOG_KEY)
      if (!raw) return
      const log = JSON.parse(raw)
      if (!log.length) return

      // Take last 3 points for upload
      const recent = log.slice(-3)

      // FIX: POST to /activity/gps (endpoint now exists in backend)
      // FIX: JWT Authorization header included
      for (const point of recent) {
        await axios.post(
          `${API_BASE}/activity/gps`,
          point,
          {
            headers: getAuthHeaders(authToken),
            timeout: 8000,
          }
        )
      }
    } catch (e) {
      // Non-critical: log but don't crash the app
      if (e.response?.status === 401) {
        console.warn("[GigShield GPS] Auth expired — stopping GPS uploads")
        if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current)
      } else {
        console.warn("[GigShield GPS] GPS upload failed:", e.message)
      }
    }
  }

  return { status }
}


// ── Utility: get recent GPS points from log ───────────────────────────────────
export async function getRecentGPSPoints(count = 3) {
  try {
    const raw = await AsyncStorage.getItem(GPS_LOG_KEY)
    if (!raw) return []
    const log = JSON.parse(raw)
    return log.slice(-count)
  } catch (e) {
    return []
  }
}


// ── Utility: clear GPS log (on logout) ───────────────────────────────────────
export async function clearGPSLog() {
  try {
    await AsyncStorage.removeItem(GPS_LOG_KEY)
  } catch (e) {
    console.warn("[GigShield GPS] Failed to clear GPS log:", e)
  }
}
