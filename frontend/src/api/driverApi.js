import { api, data } from './client'

const j = (id) => `/driver/jobs/${id}`
export const driverApi = {
  dashboard: () => data(api.get('/driver/dashboard/')),
  updateProfile: (body) => data(api.patch('/driver/dashboard/', body)),
  jobs: (params) => data(api.get('/driver/jobs/', { params })),
  job: (id) => data(api.get(`${j(id)}/`)),
  acknowledge: (id) => data(api.post(`${j(id)}/acknowledge/`)),
  setStatus: (id, body) => data(api.post(`${j(id)}/status/`, body)),
  addEvent: (id, body) => data(api.post(`${j(id)}/events/`, body)),
  sendLocation: (id, body) => data(api.post(`${j(id)}/location/`, body)),
  uploadProof: (id, file, note) => {
    const f = new FormData(); f.append('file', file); if (note) f.append('note', note)
    return data(api.post(`${j(id)}/delivery-proof/`, f))
  },
}
