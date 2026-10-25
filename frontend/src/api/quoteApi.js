import { api, data } from './client'

export const quoteApi = {
  estimate: (body) => data(api.post('/quotes/estimate/', body)),
  request: (body) => data(api.post('/quotes/request/', body)),
}
