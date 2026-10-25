import { api, crud, data, downloadFile } from './client'

const bk = (id) => `/admin/bookings/${id}`
export const adminApi = {
  dashboard: () => data(api.get('/admin/dashboard/')),
  bookings: {
    list: (params) => data(api.get('/admin/bookings/', { params })),
    get: (id) => data(api.get(`${bk(id)}/`)),
    updateStatus: (id, body) => data(api.post(`${bk(id)}/update-status/`, body)),
    assignDriver: (id, body) => data(api.post(`${bk(id)}/assign-driver/`, body)),
    quote: (id, body) => data(api.post(`${bk(id)}/quotations/`, body)),
    reschedule: (id, body) => data(api.post(`${bk(id)}/reschedule/`, body)),
    resolveReschedule: (id, body) => data(api.post(`${bk(id)}/resolve-reschedule/`, body)),
    internalNotes: (id) => data(api.get(`${bk(id)}/internal-notes/`)),
    saveInternal: (id, body) => data(api.patch(`${bk(id)}/internal/`, body)),
  },
  customers: {
    ...crud('admin/customers'),
    bookings: (id) => data(api.get(`/admin/customers/${id}/bookings/`)),
  },
  drivers: {
    ...crud('admin/drivers'),
    approve: (id) => data(api.post(`/admin/drivers/${id}/approve/`)),
    suspend: (id) => data(api.post(`/admin/drivers/${id}/suspend/`)),
    performance: (id) => data(api.get(`/admin/drivers/${id}/performance/`)),
  },
  vehicles: crud('admin/vehicles'),
  services: crud('admin/services'),
  areas: crud('admin/service-areas'),
  pricing: crud('admin/pricing-rules'),
  faqs: crud('admin/faqs'),
  content: crud('admin/site-content'),
  config: crud('admin/config'),
  inventoryItems: crud('admin/inventory-items'),
  quotations: crud('admin/quotations'),
  payments: {
    list: (params) => data(api.get('/admin/payments/', { params })),
    refund: (id, body) => data(api.post(`/admin/payments/${id}/refund/`, body)),
  },
  reviews: { list: (p) => data(api.get('/admin/reviews/', { params: p })), update: (id, b) => data(api.patch(`/admin/reviews/${id}/`, b)) },
  tickets: { list: (p) => data(api.get('/admin/support-tickets/', { params: p })), update: (id, b) => data(api.patch(`/admin/support-tickets/${id}/`, b)) },
  damage: { list: (p) => data(api.get('/admin/damage-reports/', { params: p })), update: (id, b) => data(api.patch(`/admin/damage-reports/${id}/`, b)) },
  audit: (params) => data(api.get('/admin/audit-logs/', { params })),
  report: (params) => data(api.get('/admin/reports/', { params })),
  exportReport: (params) => downloadFile('/admin/reports/', { ...params, export: 'csv' }, 'report.csv'),
}
