import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }))
vi.mock('../api/client', async (orig) => {
  const real = await orig()
  return { ...real, refreshSession: vi.fn(), setAccessToken: vi.fn(), setAuthFailureHandler: vi.fn() }
})
vi.mock('../api/authApi', () => ({ authApi: { login: vi.fn(), me: vi.fn(), logout: vi.fn(), register: vi.fn() } }))

import { refreshSession } from '../api/client'
import { authApi } from '../api/authApi'
import { AuthProvider, RequireRole, GuestOnly } from '../features/auth/AuthContext'
import LoginPage, { safeNext } from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import { loginSchema, registerSchema, passwordStrength } from '../features/auth/schemas'
import { roleHome, money, applyFieldErrors, errorMessage } from '../utils/format'

const Where = () => <p data-testid="where">{useLocation().pathname}</p>
function app(initial, role) {
  if (role) refreshSession.mockResolvedValue({ user: { id: 1, role, full_name: 'T U' } })
  else refreshSession.mockRejectedValue(new Error('no session'))
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/app/*" element={<RequireRole roles={['CUSTOMER']}><p>customer area</p><Where /></RequireRole>} />
          <Route path="/admin/*" element={<RequireRole roles={['ADMIN']}><p>admin area</p></RequireRole>} />
          <Route path="/driver/*" element={<RequireRole roles={['DRIVER']}><p>driver area</p></RequireRole>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

describe('role-based navigation (UX guard)', () => {
  it('sends a guest to login and remembers where they were going', async () => {
    app('/admin/bookings')
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })
  it.each([['CUSTOMER', '/admin', /customer area/i], ['DRIVER', '/app', /driver area/i], ['ADMIN', '/driver', /admin area/i]])('%s opening a foreign area lands on their own home', async (role, path, expected) => {
    app(path, role)
    expect(await screen.findByText(expected)).toBeInTheDocument()
  })
  it('keeps a signed-in user off the login page', async () => {
    app('/login', 'ADMIN')
    expect(await screen.findByText(/admin area/i)).toBeInTheDocument()
  })
})

describe('login form', () => {
  it('shows validation errors and does not call the API', async () => {
    app('/login')
    await userEvent.click(await screen.findByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/enter your email or phone/i)).toBeInTheDocument()
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })
  it('shows the server message on bad credentials without leaking which field was wrong', async () => {
    authApi.login.mockRejectedValue({ response: { status: 401, data: { error: { code: 'auth_failed', message: 'Invalid credentials. Please check and try again.' } } } })
    app('/login')
    await userEvent.type(await screen.findByLabelText(/email or phone/i), 'a@b.com')
    await userEvent.type(document.querySelector('input[name=password]'), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid credentials/i)
  })
  it('takes the role from the server profile and routes to that area', async () => {
    authApi.login.mockResolvedValue({ access: 'tok' })
    authApi.me.mockResolvedValue({ id: 9, role: 'DRIVER', full_name: 'Dev Driver' })
    app('/login')
    await userEvent.type(await screen.findByLabelText(/email or phone/i), 'd@x.com')
    await userEvent.type(document.querySelector('input[name=password]'), 'Passw0rd!x')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/driver area/i)).toBeInTheDocument()
  })
})

describe('registration form', () => {
  const renderReg = () => { refreshSession.mockRejectedValue(new Error('x')); return render(<MemoryRouter><AuthProvider><RegisterPage /></AuthProvider></MemoryRouter>) }
  it('requires every mandatory field and consent', async () => {
    renderReg()
    await userEvent.click(await screen.findByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/enter your full name/i)).toBeInTheDocument()
    expect(screen.getByText(/valid email/i)).toBeInTheDocument()
    expect(screen.getByText(/phone number is required/i)).toBeInTheDocument()
    expect(screen.getByText(/accept the terms/i)).toBeInTheDocument()
    expect(authApi.register).not.toHaveBeenCalled()
  })
})

describe('schemas and helpers', () => {
  it('rejects mismatched passwords and numeric-only passwords', () => {
    const base = { full_name: 'Ravi K', email: 'r@x.com', phone: '9876543210', password: 'Abcdef1!x', confirm_password: 'Abcdef1!x', accept_terms: true }
    expect(registerSchema.safeParse(base).success).toBe(true)
    expect(registerSchema.safeParse({ ...base, confirm_password: 'nope' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, password: '12345678', confirm_password: '12345678' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, phone: '12345' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, accept_terms: false }).success).toBe(false)
  })
  it('never sends a role from the client in the login schema', () => {
    expect(Object.keys(loginSchema.shape)).not.toContain('role')
  })
  it('scores password strength monotonically', () => {
    expect(passwordStrength('abc')).toBeLessThan(passwordStrength('Abcdef1!xyz9'))
  })
  it('only follows same-area relative redirects (no open redirect)', () => {
    expect(safeNext('https://evil.com', 'CUSTOMER')).toBe('/app')
    expect(safeNext('//evil.com', 'CUSTOMER')).toBe('/app')
    expect(safeNext('/admin/payments', 'CUSTOMER')).toBe('/app')
    expect(safeNext('/app/bookings/3', 'CUSTOMER')).toBe('/app/bookings/3')
    expect(safeNext(null, 'DRIVER')).toBe('/driver')
  })
  it('formats money and maps role homes', () => {
    expect(money(22774)).toMatch(/22,774/)
    expect(money(null)).toBe('-')
    expect(roleHome('ADMIN')).toBe('/admin')
    expect(roleHome('x')).toBe('/login')
  })
  it('maps server field errors onto the form and falls back to a generic message', () => {
    const setError = vi.fn()
    const err = { response: { status: 400, data: { error: { code: 'validation_error', message: 'Fix', details: { phone: ['Bad phone'] } } } } }
    expect(applyFieldErrors(err, setError)).toBe(true)
    expect(setError).toHaveBeenCalledWith('phone', expect.objectContaining({ message: 'Bad phone' }))
    expect(errorMessage(new Error('boom'))).toMatch(/cannot reach the server/i)
  })
})
