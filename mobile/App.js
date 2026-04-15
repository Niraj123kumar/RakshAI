import { NavigationContainer } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createStackNavigator } from "@react-navigation/stack"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { StatusBar, View, Text } from "react-native"

import LoginScreen from "./screens/LoginScreen"
import DashboardScreen from "./screens/DashboardScreen"
import PolicyScreen from "./screens/PolicyScreen"
import ClaimsScreen from "./screens/ClaimsScreen"
import ProfileScreen from "./screens/ProfileScreen"
import OnboardingScreen from "./screens/OnboardingScreen"

const Tab = createBottomTabNavigator()
const Stack = createStackNavigator()

function TabIcon({ name, focused }) {
  const icons = {
    Home: focused ? "◈" : "◇",
    Claims: focused ? "⬟" : "⬠",
    Policy: focused ? "⬡" : "⬡",
    Profile: focused ? "⊕" : "⊕",
  }
  return (
    <Text style={{ fontSize: 18, color: focused ? "#00D4AA" : "#444" }}>
      {icons[name]}
    </Text>
  )
}

// ── Pass worker params down to all tab screens ────────────────────────────────
function MainTabs({ route }) {
  // Worker data passed from LoginScreen
  const workerParams = route?.params || {}
  const worker = workerParams.worker
  const policy = workerParams.policy
  const token = workerParams.token

  return (
    <Tab.Navigator
      screenOptions={({ route: tabRoute }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={tabRoute.name} focused={focused} />,
        tabBarActiveTintColor: "#00D4AA",
        tabBarInactiveTintColor: "#666",
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: "#161921",
          borderTopColor: "#ffffff10",
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 62,
        },
        headerStyle: {
          backgroundColor: "#0D0F14",
          borderBottomColor: "#ffffff10",
          borderBottomWidth: 1,
        },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700", letterSpacing: -0.3, fontSize: 18 },
      })}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ title: "GigShield" }}
        initialParams={{ worker, policy, token }}
      />
      <Tab.Screen
        name="Claims"
        component={ClaimsScreen}
        options={{ title: "Claims & Payouts" }}
        initialParams={{ worker, policy, token }}
      />
      <Tab.Screen
        name="Policy"
        component={PolicyScreen}
        options={{ title: "My Policy" }}
        initialParams={{ worker, policy, token }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile" }}
        initialParams={{ worker, policy, token }}
      />
    </Tab.Navigator>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0D0F14" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
