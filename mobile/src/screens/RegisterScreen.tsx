import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { registerSchema } from '../utils/validation';
import { authAPI } from '../services/api';

export default function RegisterScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '',
    platform: 'swiggy', city: '', pincode: '', upiId: '', avgDailyHours: '8',
  });
  const [loading, setLoading] = useState(false);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleRegister = async () => {
    const result = registerSchema.safeParse({
      ...form, avgDailyHours: parseFloat(form.avgDailyHours),
    });
    if (!result.success) {
      Alert.alert('Validation Error', result.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      await authAPI.register(result.data);
      Alert.alert('Success', 'Registered! Please login.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      {[
        { key: 'name', placeholder: 'Full Name' },
        { key: 'phone', placeholder: 'Phone (10 digits)', keyboardType: 'phone-pad' },
        { key: 'email', placeholder: 'Email', keyboardType: 'email-address' },
        { key: 'password', placeholder: 'Password (min 6)', secure: true },
        { key: 'city', placeholder: 'City (e.g. mumbai)' },
        { key: 'pincode', placeholder: 'Pincode (6 digits)', keyboardType: 'numeric' },
        { key: 'upiId', placeholder: 'UPI ID (e.g. name@upi)' },
        { key: 'avgDailyHours', placeholder: 'Avg Daily Hours (1-18)', keyboardType: 'numeric' },
      ].map(({ key, placeholder, keyboardType, secure }: any) => (
        <TextInput
          key={key}
          style={styles.input}
          placeholder={placeholder}
          keyboardType={keyboardType || 'default'}
          secureTextEntry={secure || false}
          value={(form as any)[key]}
          onChangeText={v => set(key, v)}
        />
      ))}
      <Text style={styles.label}>Platform</Text>
      <View style={styles.row}>
        {['swiggy','zomato','ola','rapido','urban_company'].map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, form.platform === p && styles.chipSelected]}
            onPress={() => set('platform', p)}
          >
            <Text style={[styles.chipText, form.platform === p && styles.chipTextSelected]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>{t('register')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16 },
  label: { fontSize: 14, color: '#555', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#e94560', borderColor: '#e94560' },
  chipText: { color: '#555', fontSize: 13 },
  chipTextSelected: { color: '#fff' },
  button: { backgroundColor: '#e94560', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  link: { color: '#e94560', textAlign: 'center', fontSize: 15 },
});
