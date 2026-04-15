export interface Worker {
  id: string;
  name: string;
  phone: string;
  email: string;
  platform: 'swiggy' | 'zomato' | 'ola' | 'rapido' | 'urban_company';
  city: string;
  pincode: string;
  upiId: string;
  kycStatus: KYCStatus;
  avgDailyHours: number;
}

export interface KYCStatus {
  verified: boolean;
  documentType: 'aadhaar' | 'pan' | 'driving_license' | null;
  submittedAt: string | null;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  weeklyPremiumInr: number;
  payoutAmountInr: number;
  eventTypes: string[];
  isActive: boolean;
}

export interface PayoutEvent {
  id: string;
  workerId: string;
  policyId: string;
  eventType: string;
  zone: string;
  amountInr: number;
  status: 'initiated' | 'success' | 'failed';
  createdAt: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  city: string;
  pincode: string;
}

export interface AuthState {
  token: string | null;
  worker: Worker | null;
  isAuthenticated: boolean;
}
