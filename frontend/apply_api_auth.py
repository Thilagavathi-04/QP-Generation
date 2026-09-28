import re

with open('frontend/src/utils/api.js', 'r') as f:
    content = f.read()

# Add request interceptor
if 'api.interceptors.request.use' not in content:
    interceptor_code = """
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qp_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
"""
    content = content.replace('// Error handler', interceptor_code + '\n// Error handler')

# Add draft APIs to subjectAPI
if 'getUserDraft:' not in content:
    content = content.replace(
        "delete: (id) => api.delete(`/api/subjects/${id}`),",
        "delete: (id) => api.delete(`/api/subjects/${id}`),\n  getUserDraft: (id) => api.get(`/api/subjects/${id}/user-draft`),\n  saveUserDraft: (id, draft_data) => api.post(`/api/subjects/${id}/user-draft`, { draft_data }),"
    )

with open('frontend/src/utils/api.js', 'w') as f:
    f.write(content)
print("Applied api.js changes")
