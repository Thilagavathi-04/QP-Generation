import axios from 'axios'

export function getAuthToken() {
  return localStorage.getItem('qp_token')
}

export function attachAuthHeader(config) {
  const token = getAuthToken()
  if (token && config && config.headers && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

// Register on the global axios instance (used by Dashboard, AdminDashboard, AdminProfile)
axios.interceptors.request.use(attachAuthHeader)
