import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator, TouchableOpacity
} from 'react-native';
import axios from 'axios';

import { API_BASE, getAuthHeaders } from "../config"
const API = API_BASE

export default function ProfileScreen({ route, navigation }) {
  const { worker } = route.params || {};
  const [profile, setProfile] = useState(worker || null);
  const [loading, setLoading] = useState(!worker);
  const [morningAlert, setMorningAlert] = useState(true);
  const [payoutAlert, setPayoutAlert] = useState(true);

  useEffect(() => {
    if (!worker && route.params?.phone) {
      axios.post(`${API}/auth/login`, { phone: route.params.phone })
        .then(res => setProfile(res.data.worker))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, []);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color="#00C896" size="large" />
    </View>
  );

  if (!profile) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>Could not load profile.</Text>
    </View>
  );

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'Recently joined';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.header}>Profile</Text>

      <View style={styles.heroSection}>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.subInfo}>
          {profile.platform} · {typeof profile.zone === 'object' ? (profile.zone?.zone || profile.zone?.name) : (profile.zone || profile.city)}
        </Text>
        <View style={styles.planBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.planText}>
            {profile.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : 'Basic'} Plan · Active
          </Text>
        </View>
      </View>

      <View style={styles.riskCard}>
        <Text style={styles.riskLabel}>GigTwin Risk Score</Text>
        <View style={styles.riskBar}>
          <View style={[styles.riskFill, { width: `${profile.risk_score || 65}%` }]} />
        </View>
        <Text style={styles.riskScore}>
          <Text style={styles.riskNumber}>{profile.risk_score || 65}</Text>
          <Text style={styles.riskLevel}> MODERATE</Text>
        </Text>
        <Text style={styles.riskUpdate}>Updates weekly</Text>
      </View>

      <Text style={styles.sectionTitle}>Your details</Text>
      <View style={styles.detailsCard}>
        {[
          ['Name', profile.name],
          ['Phone', `+91 ${profile.phone}`],
          ['Platform', profile.platform],
          ['Zone', typeof profile.zone === 'object' ? (profile.zone?.zone || profile.zone?.name || JSON.stringify(profile.zone)) : (profile.zone || '—')],
          ['City', profile.city],
          ['Member since', memberSince],
        ].map(([label, value]) => (
          <View key={label} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.detailsCard}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleTitle}>Morning risk brief</Text>
            <Text style={styles.toggleSub}>Daily alert before your shift</Text>
          </View>
          <Switch value={morningAlert} onValueChange={setMorningAlert}
            trackColor={{ true: '#00C896' }} thumbColor="#fff" />
        </View>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleTitle}>Payout alerts</Text>
            <Text style={styles.toggleSub}>Notify when payout is sent</Text>
          </View>
          <Switch value={payoutAlert} onValueChange={setPayoutAlert}
            trackColor={{ true: '#00C896' }} thumbColor="#fff" />
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => navigation.replace('Login')}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0A' },
  errorText: { color: '#fff' },
  header: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 20 },
  heroSection: { alignItems: 'center', marginBottom: 24 },
  name: { color: '#fff', fontSize: 26, fontWeight: '700' },
  subInfo: { color: '#aaa', marginTop: 4 },
  planBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A2E28', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginTop: 10,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00C896', marginRight: 6 },
  planText: { color: '#00C896', fontWeight: '600' },
  riskCard: {
    backgroundColor: '#141414', borderRadius: 16,
    padding: 16, marginBottom: 24,
  },
  riskLabel: { color: '#888', fontSize: 13, marginBottom: 8 },
  riskBar: { height: 6, backgroundColor: '#2a2a2a', borderRadius: 3, marginBottom: 8 },
  riskFill: { height: 6, backgroundColor: '#F5A623', borderRadius: 3 },
  riskScore: { flexDirection: 'row', alignItems: 'baseline' },
  riskNumber: { color: '#F5A623', fontSize: 28, fontWeight: '700' },
  riskLevel: { color: '#F5A623', fontSize: 12, fontWeight: '600' },
  riskUpdate: { color: '#555', fontSize: 12, marginTop: 4 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  detailsCard: { backgroundColor: '#141414', borderRadius: 16, padding: 4, marginBottom: 24 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  detailLabel: { color: '#888' },
  detailValue: { color: '#fff', fontWeight: '500' },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  toggleTitle: { color: '#fff', fontWeight: '600' },
  toggleSub: { color: '#888', fontSize: 12, marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#FF4444',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 8,
  },
  logoutText: { color: '#FF4444', fontWeight: '700', fontSize: 16 },
});
