import axios from 'axios'

const baseURL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

// The access token lives ONLY in memory (never localStorage). The refresh token is an HttpOnly cookie
// that JavaScript cannot read; /auth/refresh/ restores the session after a page reload.
let accessToken = null
let onAuthFailure = () => {}
export const setAccessToken = (t) => { accessToken = t }
export const getAccessToken = () => accessToken
export const setAuthFailureHandler = (fn) => { onAuthFailure = fn }

export const api = axios.create({ baseURL, withCredentials: true, timeout: 30000 })

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let refreshing = null
export function refreshSession() {
  if (!refreshing) {
    refreshing = axios
      .post(`${baseURL}/auth/refresh/`, null, { withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then((r) => { accessToken = r.data.access; return r.data })
      .finally(() => { refreshing = null })
  }
  return refreshing
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { config, response } = error
    const isAuthCall = config?.url?.includes('/auth/login') || config?.url?.includes('/auth/refresh') || config?.url?.includes('/auth/register')
    if (response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true
      try {
        await refreshSession()
        config.headers.Authorization = `Bearer ${accessToken}`
        return api(config)
      } catch {
        accessToken = null
        onAuthFailure()
      }
    }
    return Promise.reject(error)
  },
)

export const data = (p) => p.then((r) => r.data)

/** Build a REST helper for a collection endpoint like 'admin/services'. */
export function crud(path) {
  return {
    list: (params) => data(api.get(`/${path}/`, { params })),
    get: (id) => data(api.get(`/${path}/${id}/`)),
    create: (body) => data(api.post(`/${path}/`, body)),
    update: (id, body) => data(api.patch(`/${path}/${id}/`, body)),
    remove: (id) => api.delete(`/${path}/${id}/`),
  }
}

export async function downloadFile(url, params, fallbackName) {
  const res = await api.get(url, { params, responseType: 'blob' })
  const cd = res.headers['content-disposition'] || ''
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallbackName
  const href = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 2000)
}
