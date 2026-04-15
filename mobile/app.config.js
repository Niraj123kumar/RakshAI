/**
 * GigShield Expo Config
 * Set EXPO_PUBLIC_API_URL in your .env to point to your backend.
 * Example:
 *   Development: EXPO_PUBLIC_API_URL=http://localhost:8000
 *   Production:  EXPO_PUBLIC_API_URL=https://api.gigshield.in
 */
export default {
  expo: {
    name: "GigShield",
    slug: "gigshield",
    version: "1.0.0",
    orientation: "portrait",
    extra: {
      // Read from .env at build time
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000",
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "GigShield needs location access to monitor disruptions in your delivery zone.",
          locationAlwaysPermission: "GigShield needs background location to monitor zone disruptions during your shift.",
          locationWhenInUsePermission: "GigShield needs location to verify your zone during payout eligibility checks.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
        }
      ]
    ],
  },
}
