import { z } from 'zod';

export const roleSchema = z.enum(['ADMIN', 'DISPATCHER', 'DRIVER']);
export type Role = z.infer<typeof roleSchema>;

export const registerSchema = z.object({
  companyName: z.string().trim().min(2, 'Numele firmei e prea scurt').max(100),
  cui: z
    .string()
    .trim()
    .regex(/^(RO)?\d{2,10}$/, 'CUI invalid (ex: RO12345678)')
    .optional(),
  name: z.string().trim().min(2, 'Numele e prea scurt').max(100),
  email: z.email('Email invalid'),
  // bcrypt ignoră tot ce depășește 72 de bytes, deci limităm explicit
  password: z.string().min(8, 'Parola trebuie să aibă minim 8 caractere').max(72),
});

export const loginSchema = z.object({
  email: z.email('Email invalid'),
  password: z.string().min(1, 'Parola e obligatorie'),
});

export const authUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  role: roleSchema,
  companyId: z.string(),
  companyName: z.string(),
});

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
