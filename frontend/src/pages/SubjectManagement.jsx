import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit, Trash2, BookOpen, Database, FileText, Upload, Loader2 } from 'lucide-react'
import api from '../utils/api'
import { showToast } from '../components/Toast'
import Modal from '../components/Modal'

const SubjectManagement = () => {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [modalState, setModalState] = useState({ isOpen: false, type: '', data: null })
  const [formData, setFormData] = useState({
    subjectId: '',
    name: '',
    syllabusFile: null,
    bookFile: null,
    useBookForGeneration: false
  })

  // Fetch subjects on component mount
  useEffect(() => {
    fetchSubjects()
  }, [])

  const fetchSubjects = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/subjects')
      setSubjects(response.data)
    } catch (error) {
      console.error('Error fetching subjects:', error)
      showToast('Failed to load subjects', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e, fileType) => {
    const file = e.target.files[0]
    if (file && (file.type === 'application/pdf' || file.type.includes('word'))) {
      setFormData(prev => ({ ...prev, [fileType]: file }))
    } else {
      showToast('Please select a PDF or Word document', 'warning')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.subjectId || !formData.name) {
      showToast('Subject ID and name are required', 'warning')
      return
    }

    try {
      // Create FormData for file upload
      const formDataToSend = new FormData()
      formDataToSend.append('subject_id', formData.subjectId)
      formDataToSend.append('name', formData.name)
      formDataToSend.append('use_book_for_generation', formData.useBookForGeneration)

      if (formData.syllabusFile) {
        formDataToSend.append('syllabus_file', formData.syllabusFile)
      }

      if (formData.bookFile) {
        formDataToSend.append('book_file', formData.bookFile)
      }

      await api.post('/api/subjects', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // Reset form and close modal
      setFormData({
        subjectId: '',
        name: '',
        syllabusFile: null,
        bookFile: null,
        useBookForGeneration: false
      })
      setShowCreateForm(false)

      // Refresh subjects list
      fetchSubjects()
      showToast('Subject created successfully!', 'success')
    } catch (error) {
      console.error('Error creating subject:', error)
      showToast(error.response?.data?.detail || 'Failed to create subject', 'error')
    }
  }

  const handleDelete = async (id) => {
    setModalState({
      isOpen: true,
      type: 'danger',
      title: 'Delete Subject',
      message: 'Are you sure you want to delete this subject? This will delete all associated data including units, topics, questions, and question banks.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api.delete(`/api/subjects/${id}`)
          fetchSubjects()
          showToast('Subject deleted successfully!', 'success')
        } catch (error) {
          console.error('Error deleting subject:', error)
          showToast('Failed to delete subject', 'error')
        }
      }
    })
  }

  return (
    <div style={{
      width: '100%',
      padding: '2rem',
      minHeight: '100vh'
    }}>
      <div style={{
        background: 'var(--gradient-banner)',
        padding: '2rem',
        borderRadius: '16px',
        marginBottom: '2rem',
        boxShadow: 'var(--shadow-rose)',
        color: 'white'
      }} className="fade-in">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              marginBottom: '0.5rem',
              color: 'white',
              textShadow: '0 2px 4px rgba(252, 245, 245, 0.1)'
            }}>Subject Management</h1>
            <p style={{ opacity: 0.95, fontSize: '0.95rem' }}>
              Create and manage subjects with syllabus and reference materials
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn"
            style={{
              background: 'white',
              color: 'var(--primary-600)',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Plus size={20} />
            {showCreateForm ? 'Cancel' : 'Add Subject'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="card fade-in" style={{
          marginBottom: '2rem',
          background: 'white',
          borderLeft: '4px solid var(--primary-400)',
          animation: 'fadeIn 0.4s ease-out'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            marginBottom: '1.5rem',
            color: 'var(--primary-700)'
          }}>Create New Subject</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Subject ID *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.subjectId}
                  onChange={(e) => setFormData(prev => ({ ...prev, subjectId: e.target.value }))}
                  placeholder="e.g., CS101, MATH201"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Subject Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Syllabus File * (PDF/Word)</label>
                <div className="file-upload">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleFileChange(e, 'syllabusFile')}
                    id="syllabus-file"
                  />
                  <label htmlFor="syllabus-file">
                    <Upload size={24} />
                    <div className="file-upload-text">
                      {formData.syllabusFile ? formData.syllabusFile.name : 'Click to upload syllabus'}
                    </div>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reference Book (PDF/Word)</label>
                <div className="file-upload">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleFileChange(e, 'bookFile')}
                    id="book-file"
                  />
                  <label htmlFor="book-file">
                    <Upload size={24} />
                    <div className="file-upload-text">
                      {formData.bookFile ? formData.bookFile.name : 'Click to upload book (optional)'}
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer',
                color: formData.bookFile ? 'var(--secondary-700)' : 'var(--secondary-400)',
                fontSize: '0.95rem',
                fontWeight: '500',
                userSelect: 'none'
              }}>
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={formData.useBookForGeneration}
                  onChange={(e) => setFormData(prev => ({ ...prev, useBookForGeneration: e.target.checked }))}
                  disabled={!formData.bookFile}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span>Generate questions from uploaded book only (requires book upload)</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn btn-primary">Create Subject</button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subjects List */}
      {loading ? (
        <div className="card fade-in" style={{
          textAlign: 'center',
          padding: '3rem',
          background: 'var(--gradient-pastel-light)'
        }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '1rem', color: 'var(--primary-600)', fontWeight: '600' }}>Loading subjects...</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="card fade-in" style={{
          textAlign: 'center',
          padding: '3rem',
          background: 'linear-gradient(135deg, #f0fdff 0%, #e0f7fa 100%)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 1.5rem',
            background: 'var(--gradient-pastel-primary)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BookOpen size={40} style={{ color: 'white' }} />
          </div>
          <h3 style={{ color: 'var(--primary-700)', marginBottom: '0.5rem' }}>No subjects created yet</h3>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            Start by creating your first subject with syllabus upload
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            <Plus size={20} />
            Create First Subject
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '1.5rem'
        }}>
          {subjects.map((subject, index) => (
            <div
              key={subject.id}
              className="card hover-lift fade-in"
              style={{
                animationDelay: `${index * 0.05}s`,
                background: 'var(--gradient-pastel-card)',
                border: '1px solid var(--primary-100)',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1rem'
              }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: 'var(--primary-800)',
                  marginBottom: '0.25rem'
                }}>{subject.name}</h3>
              </div>

              <div style={{
                display: 'inline-block',
                background: 'var(--gradient-peach-contrast)',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: '600',
                marginBottom: '1rem'
              }}>
                ID: {subject.subject_id}
              </div>

              <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem' }}>
                {subject.syllabus_file && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    padding: '0.5rem',
                    background: 'var(--rose-50)',
                    borderRadius: '8px'
                  }}>
                    <FileText size={16} style={{ color: 'var(--primary-400)' }} />
                    <span style={{ color: 'var(--primary-700)', fontWeight: '500' }}>
                      Syllabus: {subject.syllabus_file.split('/').pop()}
                    </span>
                  </div>
                )}

                {subject.book_file && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    padding: '0.5rem',
                    background: 'var(--rose-50)',
                    borderRadius: '8px'
                  }}>
                    <BookOpen size={16} style={{ color: 'var(--primary-400)' }} />
                    <span style={{ color: 'var(--primary-700)', fontWeight: '500' }}>
                      Book: {subject.book_file.split('/').pop()}
                    </span>
                    {subject.use_book_for_generation && (
                      <span style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: '600'
                      }}>
                        Primary Source
                      </span>
                    )}
                  </div>
                )}

                <div style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #e0f2fe',
                  color: '#94a3b8'
                }}>
                  Created: {new Date(subject.created_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #e0f2fe'
              }}>
                <Link
                  to={`/generate-questions/${subject.id}`}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.875rem',
                    padding: '0.5rem 1rem',
                    flex: '1',
                    minWidth: '120px',
                    justifyContent: 'center'
                  }}
                >
                  <Plus size={16} />
                  Generate
                </Link>
                <Link
                  to={`/question-bank/${subject.id}`}
                  className="btn"
                  style={{
                    fontSize: '0.875rem',
                    padding: '0.5rem 1rem',
                    background: 'var(--gradient-sage-contrast)',
                    color: 'white',
                    flex: '1',
                    minWidth: '100px',
                    justifyContent: 'center'
                  }}
                >
                  <Database size={16} />
                  Bank
                </Link>
                <button
                  onClick={() => handleDelete(subject.id)}
                  className="btn btn-danger"
                  style={{
                    fontSize: '0.875rem',
                    padding: '0.5rem 0.75rem'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText || 'Confirm'}
        type={modalState.type}
      />
    </div>
  )
}

export default SubjectManagement
