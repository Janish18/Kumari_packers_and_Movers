import { api, data } from './client'

export const paymentApi = {
  list: (params) => data(api.get('/customer/payments/', { params })),
  createOrder: (booking, kind) => data(api.post('/customer/payments/create-order/', { booking, kind })),
  verify: (body) => data(api.post('/customer/payments/verify/', body)),
}
