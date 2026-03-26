import axios from 'axios'

// Configure base URL for API calls
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8010'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 600000, // 10 minutes
})

// API endpoints for subjects
export const subjectAPI = {
  getAll: () => api.get('/api/subjects'),
  getById: (id) => api.get(`/api/subjects/${id}`),
  create: (data) => api.post('/api/subjects', data),
  update: (id, data) => api.put(`/api/subjects/${id}`, data),
  delete: (id) => api.delete(`/api/subjects/${id}`),
}

// API endpoints for question generation
export const questionAPI = {
  generate: (data) => api.post('/api/questions/generate', data),
  getBySubject: (subjectId) => api.get(`/api/questions/subject/${subjectId}`),
  create: (data) => api.post('/api/questions', data),
  saveToBank: (questions) => api.post('/api/questions/save-to-bank', { questions }),
  delete: (id) => api.delete(`/api/questions/${id}`),
  search: (params) => api.get('/api/questions/search', { params }),
  export: (questionIds) => api.post('/api/questions/export', { questionIds }, {
    responseType: 'blob'
  }),
}

// API endpoints for blueprints
export const blueprintAPI = {
  getAll: () => api.get('/api/blueprints'),
  getById: (id) => api.get(`/api/blueprints/${id}`),
  create: (formData) => api.post('/api/blueprints', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, formData) => api.put(`/api/blueprints/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id) => api.delete(`/api/blueprints/${id}`),
}

// API endpoints for question paper generation
export const paperAPI = {
  generate: (data) => api.post('/api/question-papers/generate', data),
  getAll: () => api.get('/api/question-papers'),
  getById: (id) => api.get(`/api/question-papers/${id}`),
  download: (id, format) => api.get(`/api/question-papers/${id}/download`, {
    params: { format },
    responseType: 'blob'
  }),
  delete: (id) => api.delete(`/api/question-papers/${id}`),
  search: (params) => api.get('/api/question-papers/search', { params }),
}

// API endpoints for dashboard stats
export const statsAPI = {
  getDashboard: () => api.get('/api/dashboard/stats'),
  getRecentActivity: () => api.get('/api/stats/recent-activity'),
}

// Error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If it's a timeout error
    if (error.code === 'ECONNABORTED') {
      console.error('API Timeout:', error)
      const timeoutError = new Error('Request timed out. The AI generation is taking longer than expected.')
      timeoutError.response = { data: { detail: 'Request timed out. The AI generation is taking longer than expected.' } }
      throw timeoutError
    }

    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.data)
      // Extract FastAPI detail message
      const detail = error.response.data.detail
      const message = typeof detail === 'string' ? detail :
        (Array.isArray(detail) ? detail.map(d => d.msg).join(', ') :
          (detail?.message || 'An error occurred'))

      // Preserve the original response in the thrown error
      const enhancedError = new Error(message)
      enhancedError.response = error.response
      throw enhancedError
    } else if (error.request) {
      // Request made but no response received
      console.error('Network Error:', error.request)
      const networkError = new Error('Network error - please check your connection')
      throw networkError
    } else {
      // Something else happened
      console.error('Error:', error.message)
      throw error
    }
  }
)

export default api