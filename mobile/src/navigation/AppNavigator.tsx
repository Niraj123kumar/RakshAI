/**
 * AppNavigator.tsx
 *
 * Full navigation tree:
 *   Stack:
 *     Login  → (phone-only, no password)
 *     Onboarding → (3-step GigTwin creation)
 *     Main   → MainTabs (bottom tab navigator)
 *
 *   MainTabs:
 *     Home     → DashboardScreen
 *     Claims   → ClaimsScreen
 *     Policy   → PolicyScreen
 *     Profile  → ProfileScreen
 *
 * NOTE: The root App.tsx already imports the working App.js which has
 * this same structure. This file is kept in sync for completeness.
 */
import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Screens — using the existing JS screens (all fully working)
// Import paths: ../../screens/ (the original JS files with all fixes)
const LoginScreen = require('../../screens/LoginScreen').default;
const OnboardingScreen = require('../../screens/OnboardingScreen').default;
const DashboardScreen = require('../../screens/DashboardScreen').default;
const ClaimsScreen = require('../../screens/ClaimsScreen').default;
const PolicyScreen = require('../../screens/PolicyScreen').default;
const ProfileScreen = require('../../screens/ProfileScreen').default;

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: focused ? '◈' : '◇',
    Claims: focused ? '⬟' : '⬠',
    Policy: focused ? '⬡' : '⬡',
    Profile: focused ? '⊕' : '⊕',
  };
  return (
    <Text style={{ fontSize: 18, color: focused ? '#00D4AA' : '#444' }}>
      {icons[name] || '●'}
    </Text>
  );
}

function MainTabs({ route }: any) {
  const workerParams = route?.params || {};
  const { worker, policy, token } = workerParams;

  return (
    <Tab.Navigator
      screenOptions={({ route: tabRoute }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={tabRoute.name} focused={focused} />,
        tabBarActiveTintColor: '#00D4AA',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#161921',
          borderTopColor: '#ffffff10',
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 62,
        },
        headerStyle: { backgroundColor: '#0D0F14' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen}
        options={{ title: 'GigShield' }}
        initialParams={{ worker, policy, token }} />
      <Tab.Screen name="Claims" component={ClaimsScreen}
        options={{ title: 'Claims & Payouts' }}
        initialParams={{ worker, policy, token }} />
      <Tab.Screen name="Policy" component={PolicyScreen}
        options={{ title: 'My Policy' }}
        initialParams={{ worker, policy, token }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ title: 'Profile' }}
        initialParams={{ worker, policy, token }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
