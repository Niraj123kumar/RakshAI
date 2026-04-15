import { z } from 'zod';

export const loginSchema = z.object({
  phone: z.string().min(10).max(10).regex(/^[0-9]+$/, 'Enter valid 10-digit phone'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name too short'),
  phone: z.string().min(10).max(10).regex(/^[0-9]+$/),
  email: z.string().email('Invalid email'),
  password: z.string().min(6),
  platform: z.enum(['swiggy', 'zomato', 'ola', 'rapido', 'urban_company']),
  city: z.string().min(2),
  pincode: z.string().length(6).regex(/^[0-9]+$/),
  upiId: z.string().min(5, 'Invalid UPI ID'),
  avgDailyHours: z.number().min(1).max(18),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
