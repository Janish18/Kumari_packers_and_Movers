import { api, data } from './client'

export const publicApi = {
  services: () => data(api.get('/services/')),
  areas: (q) => data(api.get('/service-areas/', { params: q ? { q } : {} })),
  faqs: () => data(api.get('/faqs/')),
  reviews: () => data(api.get('/reviews/')),
  siteConfig: () => data(api.get('/site-config/')),
  inventoryItems: () => data(api.get('/inventory-items/')),
}
