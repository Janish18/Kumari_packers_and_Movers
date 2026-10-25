import { z } from 'zod'

export const phoneRule = z.string().trim().min(1, 'Phone number is required').refine((v) => /^\+?\d{10,14}$/.test(v.replace(/[\s\-()]/g, '')), 'Enter a valid phone number (10-14 digits)')
export const passwordRule = z.string().min(8, 'Use at least 8 characters').refine((v) => !/^\d+$/.test(v), 'Password cannot be only numbers')

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or phone number'),
  password: z.string().min(1, 'Enter your password'),
  remember_me: z.boolean().optional(),
})

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: phoneRule,
  password: passwordRule,
  confirm_password: z.string().min(1, 'Confirm your password'),
  address_line1: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  accept_terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms to continue' }) }),
}).refine((d) => d.password === d.confirm_password, { path: ['confirm_password'], message: 'Passwords do not match' })

export const forgotSchema = z.object({ email: z.string().trim().email('Enter a valid email address') })
export const resetSchema = z.object({ new_password: passwordRule, confirm: z.string() }).refine((d) => d.new_password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })

export function passwordStrength(pw = '') {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(s, 4)
}
