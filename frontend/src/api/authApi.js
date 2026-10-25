import { api, crud, data } from './client'

export const authApi = {
  register: (body) => data(api.post('/auth/register/', body)),
  login: (body) => data(api.post('/auth/login/', body)),
  logout: () => api.post('/auth/logout/'),
  me: () => data(api.get('/auth/me/')),
  updateMe: (body) => data(api.patch('/auth/me/', body)),
  forgotPassword: (email) => data(api.post('/auth/forgot-password/', { email })),
  resetPassword: (body) => data(api.post('/auth/reset-password/', body)),
  changePassword: (body) => data(api.post('/auth/change-password/', body)),
  addresses: crud('auth/addresses'),
}
