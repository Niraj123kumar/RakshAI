import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      welcome: 'Welcome to RakshAI',
      login: 'Login',
      register: 'Register',
      phone: 'Phone Number',
      password: 'Password',
      myPolicies: 'My Policies',
      payouts: 'Payouts',
      profile: 'Profile',
      subscribe: 'Subscribe',
      weeklyPremium: 'Weekly Premium',
      payoutAmount: 'Payout Amount',
      kycPending: 'KYC Pending',
      kycVerified: 'KYC Verified',
    },
  },
  hi: {
    translation: {
      welcome: 'RakshAI में आपका स्वागत है',
      login: 'लॉगिन',
      register: 'रजिस्टर करें',
      phone: 'फ़ोन नंबर',
      password: 'पासवर्ड',
      myPolicies: 'मेरी पॉलिसी',
      payouts: 'भुगतान',
      profile: 'प्रोफ़ाइल',
      subscribe: 'सदस्यता लें',
      weeklyPremium: 'साप्ताहिक प्रीमियम',
      payoutAmount: 'भुगतान राशि',
      kycPending: 'KYC लंबित',
      kycVerified: 'KYC सत्यापित',
    },
  },
  ta: {
    translation: {
      welcome: 'RakshAI-க்கு வரவேற்கிறோம்',
      login: 'உள்நுழைய',
      register: 'பதிவு செய்யுங்கள்',
      phone: 'தொலைபேசி எண்',
      password: 'கடவுச்சொல்',
      myPolicies: 'என் பாலிசிகள்',
      payouts: 'கட்டணங்கள்',
      profile: 'சுயவிவரம்',
      subscribe: 'சந்தா செலுத்துங்கள்',
      weeklyPremium: 'வாராந்திர பிரீமியம்',
      payoutAmount: 'கட்டண தொகை',
      kycPending: 'KYC நிலுவையில்',
      kycVerified: 'KYC சரிபார்க்கப்பட்டது',
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
