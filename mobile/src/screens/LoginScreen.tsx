import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const clean = phone.replace(/\D/g, '').slice(0, 10);
    if (clean.length !== 10) {
      Alert.alert('Validation Error', 'Enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.login({ phone: clean });
      const data = res.data;
      if (data.status === 'found') {
        // Store token for interceptor; also pass via params for screens that
        // need it before the interceptor fires.
        await AsyncStorage.setItem('token', data.token);
        navigation.replace('Main', {
          worker: data.worker,
          policy: data.policy,
          token: data.token,
          phone: clean,
        });
      } else if (data.status === 'not_registered') {
        navigation.navigate('Onboarding', { phone: clean });
      }
    } catch (e: any) {
      Alert.alert('Login Failed', e.response?.data?.detail || 'Network error. Check connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoArea}>
        <Text style={styles.logoIcon}>⬡</Text>
        <Text style={styles.title}>GigShield</Text>
        <Text style={styles.subtitle}>AI Income Protection</Text>
      </View>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Sign In</Text>
        <Text style={styles.formSub}>Enter your registered phone number</Text>
        <View style={styles.phoneRow}>
          <Text style={styles.countryCode}>🇮🇳 +91</Text>
          <TextInput
            style={styles.input}
            placeholder="9876543210"
            placeholderTextColor="#444"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={t => setPhone(t.replace(/\D/g, '').slice(0, 10))}
          />
        </View>
        <TouchableOpacity
          style={[styles.button, (loading || phone.length < 10) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading || phone.length < 10}
        >
          {loading
            ? <ActivityIndicator color="#0D0F14" />
            : <Text style={styles.buttonText}>Continue →</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Onboarding', { phone })}>
          <Text style={styles.link}>
            New rider? <Text style={{ color: '#00D4AA', fontWeight: '700' }}>Sign up in 3 minutes</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0D0F14' },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoIcon: { fontSize: 48, color: '#00D4AA', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  subtitle: { color: '#555', fontSize: 13, letterSpacing: 1, marginTop: 4 },
  formCard: { backgroundColor: '#161921', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#ffffff08' },
  formTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  formSub: { color: '#777', fontSize: 13, marginBottom: 20 },
  phoneRow: { flexDirection: 'row', backgroundColor: '#0D0F14', borderRadius: 14, borderWidth: 1, borderColor: '#ffffff10', alignItems: 'center', marginBottom: 16, paddingHorizontal: 14 },
  countryCode: { color: '#FFFFFF', fontSize: 14, paddingVertical: 14, marginRight: 10, borderRightWidth: 1, borderRightColor: '#ffffff10', paddingRight: 14 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 16, padding: 14 },
  button: { backgroundColor: '#00D4AA', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 14 },
  buttonDisabled: { backgroundColor: '#00D4AA55' },
  buttonText: { color: '#0D0F14', fontSize: 16, fontWeight: '700' },
  link: { color: '#666', textAlign: 'center', fontSize: 14 },
});
