import { api, data, downloadFile } from './client'

const b = (id) => `/customer/bookings/${id}`
export const bookingApi = {
  dashboard: () => data(api.get('/customer/dashboard/')),
  list: (params) => data(api.get('/customer/bookings/', { params })),
  get: (id) => data(api.get(`${b(id)}/`)),
  create: (body) => data(api.post('/customer/bookings/', body)),
  update: (id, body) => data(api.patch(`${b(id)}/`, body)),
  submit: (id) => data(api.post(`${b(id)}/submit/`)),
  acceptQuote: (id, quotation_id) => data(api.post(`${b(id)}/accept-quote/`, { quotation_id })),
  cancel: (id, reason) => data(api.post(`${b(id)}/cancel/`, { reason })),
  reschedule: (id, body) => data(api.post(`${b(id)}/reschedule/`, body)),
  tracking: (id) => data(api.get(`${b(id)}/tracking/`)),
  uploadPhoto: (id, file) => {
    const f = new FormData(); f.append('file', file)
    return data(api.post(`${b(id)}/photos/`, f))
  },
  notifications: (params) => data(api.get('/notifications/', { params })),
  markRead: (id) => data(api.patch(`/notifications/${id}/`, { is_read: true })),
  markAllRead: () => data(api.post('/notifications/mark-all-read/')),
  createReview: (body) => data(api.post('/customer/reviews/', body)),
  tickets: (params) => data(api.get('/customer/support-tickets/', { params })),
  createTicket: (body) => data(api.post('/customer/support-tickets/', body)),
  damageReports: () => data(api.get('/customer/damage-reports/')),
  createDamage: (body) => data(api.post('/customer/damage-reports/', body)),
  uploadDamagePhoto: (id, file) => { const f = new FormData(); f.append('file', file); return data(api.post(`/customer/damage-reports/${id}/photos/`, f)) },
  invoices: () => data(api.get('/customer/invoices/')),
  downloadInvoice: (id) => downloadFile(`/customer/invoices/${id}/download/`, null, 'invoice.pdf'),
}
