import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { policyAPI } from '../services/api';
import { Policy } from '../types';

export default function PolicyScreen() {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    policyAPI.list()
      .then(res => setPolicies(res.data))
      .catch(() => Alert.alert('Error', 'Could not load policies'))
      .finally(() => setLoading(false));
  }, []);

  const subscribe = async (id: string) => {
    try {
      await policyAPI.subscribe(id);
      Alert.alert('Success', 'Policy subscribed successfully');
    } catch {
      Alert.alert('Error', 'Subscription failed');
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#e94560" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('myPolicies')}</Text>
      <FlatList
        data={policies}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.detail}>{t('weeklyPremium')}: ₹{item.weeklyPremiumInr}</Text>
            <Text style={styles.detail}>{t('payoutAmount')}: ₹{item.payoutAmountInr}</Text>
            <TouchableOpacity style={styles.button} onPress={() => subscribe(item.id)}>
              <Text style={styles.buttonText}>{t('subscribe')}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#1a1a2e' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 8 },
  detail: { fontSize: 14, color: '#555', marginBottom: 4 },
  button: { backgroundColor: '#e94560', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});
