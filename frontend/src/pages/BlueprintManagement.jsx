import React, { useState, useEffect } from 'react'
import { Plus, Upload, Edit, Trash2, Eye, FileText, X } from 'lucide-react'
import api from '../utils/api'
import { showToast } from '../components/Toast'
import Modal from '../components/Modal'

const BlueprintManagement = () => {
  const [blueprints, setBlueprints] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalState, setModalState] = useState({ isOpen: false, type: '', data: null })
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parts: [
      {
        part_name: 'Part A',
        instructions: 'Answer all questions',
        num_questions: 10,
        marks_per_question: 2,
        difficulty: 'easy'
      }
    ]
  })

  useEffect(() => {
    fetchBlueprints()
  }, [])

  const fetchBlueprints = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/api/blueprints')
      setBlueprints(response.data)
    } catch (err) {
      console.error('Error fetching blueprints:', err)
      setError(err.response?.data?.detail || 'Failed to fetch blueprints')
    } finally {
      setLoading(false)
    }
  }

  const addPart = () => {
    const newPartNumber = formData.parts.length + 1
    const partLetter = String.fromCharCode(64 + newPartNumber) // A, B, C, etc.
    setFormData({
      ...formData,
      parts: [
        ...formData.parts,
        {
          part_name: `Part ${partLetter}`,
          instructions: 'Answer all questions',
          num_questions: 5,
          marks_per_question: 5,
          difficulty: 'medium'
        }
      ]
    })
  }

  const removePart = (index) => {
    if (formData.parts.length === 1) {
      showToast('Blueprint must have at least one part', 'warning')
      return
    }
    setFormData({
      ...formData,
      parts: formData.parts.filter((_, i) => i !== index)
    })
  }

  const updatePart = (index, field, value) => {
    const updatedParts = [...formData.parts]
    updatedParts[index] = {
      ...updatedParts[index],
      [field]: value
    }
    setFormData({
      ...formData,
      parts: updatedParts
    })
  }

  const calculateTotalMarks = () => {
    return formData.parts.reduce((total, part) => {
      return total + (part.num_questions * part.marks_per_question)
    }, 0)
  }

  const calculateTotalQuestions = () => {
    return formData.parts.reduce((total, part) => {
      return total + parseInt(part.num_questions || 0)
    }, 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!formData.name.trim()) {
      showToast('Please enter a blueprint name', 'warning')
      return
    }

    if (formData.parts.length === 0) {
      showToast('Please add at least one part', 'warning')
      return
    }

    // Validate parts
    for (let i = 0; i < formData.parts.length; i++) {
      const part = formData.parts[i]
      if (!part.part_name || !part.num_questions || !part.marks_per_question || !part.difficulty) {
        showToast(`Please fill all required fields for Part ${i + 1} (name, questions, marks, difficulty)`, 'warning')
        return
      }

      if (part.num_questions <= 0) {
        showToast(`Part ${i + 1}: Number of questions must be greater than 0`, 'warning')
        return
      }

      if (part.marks_per_question <= 0) {
        showToast(`Part ${i + 1}: Marks per question must be greater than 0`, 'warning')
        return
      }
    }

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || '',
        parts_config: formData.parts.map(part => ({
          part_name: part.part_name.trim(),
          instructions: part.instructions.trim() || 'Answer all questions',
          num_questions: parseInt(part.num_questions),
          marks_per_question: parseFloat(part.marks_per_question),
          difficulty: part.difficulty.toLowerCase()
        }))
      }

      console.log('Sending blueprint data:', JSON.stringify(payload, null, 2))

      const response = await api.post('/api/blueprints', payload)

      if (response.data) {
        showToast('Blueprint created successfully!', 'success')
        resetForm()
        await fetchBlueprints()
      }
    } catch (err) {
      console.error('Error creating blueprint:', err)
      console.error('Full error response:', err.response)
      console.error('Error data:', err.response?.data)

      if (err.response?.data?.detail) {
        const detail = err.response.data.detail
        console.error('Validation error details:', JSON.stringify(detail, null, 2))

        if (Array.isArray(detail)) {
          detail.forEach(error => {
            const field = error.loc.join(' → ')
            const message = `Field: ${field}\nError: ${error.msg}`
            console.error('Validation error:', message)
            showToast(message, 'error', 8010)
          })
        } else if (typeof detail === 'string') {
          showToast(detail, 'error', 5000)
        } else {
          showToast('Validation failed: ' + JSON.stringify(detail), 'error', 5000)
        }
      } else {
        showToast('Failed to create blueprint. Please check your connection.', 'error')
      }
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      parts: [
        {
          part_name: 'Part A',
          instructions: 'Answer all questions',
          num_questions: 10,
          marks_per_question: 2,
          difficulty: 'easy'
        }
      ]
    })
    setShowCreateForm(false)
  }

  const handleDelete = (blueprintId) => {
    setModalState({
      isOpen: true,
      type: 'danger',
      title: 'Delete Blueprint',
      message: 'Are you sure you want to delete this blueprint? This action cannot be undone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api.delete(`/api/blueprints/${blueprintId}`)
          await fetchBlueprints()
          showToast('Blueprint deleted successfully!', 'success')
        } catch (err) {
          console.error('Error deleting blueprint:', err)
          showToast(err.response?.data?.detail || 'Failed to delete blueprint', 'error')
        }
      }
    })
  }

  const viewBlueprint = async (blueprint) => {
    try {
      const response = await api.get(`/api/blueprints/${blueprint.id}`)
      const fullBlueprint = response.data

      let partsInfo = 'No parts configured'

      if (fullBlueprint.parts && fullBlueprint.parts.length > 0) {
        partsInfo = fullBlueprint.parts.map(part =>
          `${part.part_name} (${part.difficulty}):\n  ${part.num_questions} questions × ${part.marks_per_question} marks = ${part.num_questions * part.marks_per_question} marks\n  Instructions: ${part.instructions || 'None'}`
        ).join('\n\n')
      }

      setModalState({
        isOpen: true,
        type: 'info',
        title: fullBlueprint.name,
        message: `Description: ${fullBlueprint.description || 'No description'}\n\nTotal Questions: ${fullBlueprint.total_questions || 0}\nTotal Marks: ${fullBlueprint.total_marks || 0}\n\n=== PARTS ===\n${partsInfo}\n\nCreated: ${new Date(fullBlueprint.created_at).toLocaleString()}`,
        confirmText: 'Close',
        onConfirm: () => { }
      })
    } catch (err) {
      console.error('Error fetching blueprint details:', err)
      showToast('Failed to load blueprint details', 'error')
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
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
              textShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>QP Blueprint</h1>
            <p style={{ opacity: 0.95, fontSize: '0.95rem' }}>
              Create and manage exam blueprints for structured question papers
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
            {showCreateForm ? 'Cancel' : 'Add Blueprint'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="card">
          <h2 className="card-title">Create New Blueprint</h2>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            Configure your question paper structure with multiple parts and instructions.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Basic Information */}
            <div className="form-group">
              <label className="form-label">Blueprint Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Mid-Term Exam Blueprint"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                placeholder="Describe the blueprint structure..."
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Parts Configuration */}
            <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Parts Configuration</h3>
                <button
                  type="button"
                  onClick={addPart}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  <Plus size={16} />
                  Add Part
                </button>
              </div>

              {formData.parts.map((part, index) => (
                <div
                  key={index}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    backgroundColor: '#f9fafb'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                      {part.part_name}
                      <span style={{
                        marginLeft: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        backgroundColor: part.difficulty === 'easy' ? '#d4edda' : part.difficulty === 'medium' ? '#fff3cd' : '#f8d7da',
                        color: part.difficulty === 'easy' ? '#155724' : part.difficulty === 'medium' ? '#856404' : '#721c24'
                      }}>
                        {part.difficulty.charAt(0).toUpperCase() + part.difficulty.slice(1)}
                      </span>
                    </h4>
                    {formData.parts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePart(index)}
                        className="btn btn-danger"
                        style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.875rem' }}>Part Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g., Part A"
                        value={part.part_name}
                        onChange={(e) => updatePart(index, 'part_name', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.875rem' }}>Number of Questions *</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g., 10"
                        min="1"
                        value={part.num_questions}
                        onChange={(e) => updatePart(index, 'num_questions', parseInt(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.875rem' }}>Marks per Question *</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g., 2"
                        min="0.5"
                        step="0.5"
                        value={part.marks_per_question}
                        onChange={(e) => updatePart(index, 'marks_per_question', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.875rem' }}>Difficulty Level *</label>
                      <select
                        className="form-input"
                        value={part.difficulty}
                        onChange={(e) => updatePart(index, 'difficulty', e.target.value)}
                        required
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                      <label className="form-label" style={{ fontSize: '0.875rem' }}>Instructions</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g., Answer all questions, Choose any 5 questions"
                        value={part.instructions}
                        onChange={(e) => updatePart(index, 'instructions', e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    color: '#666'
                  }}>
                    <strong>Part Total:</strong> {part.num_questions} questions × {part.marks_per_question} marks = <strong>{part.num_questions * part.marks_per_question} marks</strong>
                  </div>
                </div>
              ))}

              {/* Total Summary */}
              <div style={{
                padding: '1rem',
                backgroundColor: 'var(--rose-50)',
                borderRadius: '8px',
                border: '1px solid var(--primary-200)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '1rem' }}>Total Questions:</strong>
                    <span style={{ fontSize: '1.25rem', marginLeft: '0.5rem', color: 'var(--primary-700)' }}>
                      {calculateTotalQuestions()}
                    </span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '1rem' }}>Total Marks:</strong>
                    <span style={{ fontSize: '1.25rem', marginLeft: '0.5rem', color: 'var(--primary-700)' }}>
                      {calculateTotalMarks()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <Upload size={16} />
                Create Blueprint
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="card" style={{ backgroundColor: '#fee', borderColor: '#fcc' }}>
          <p style={{ color: '#c33', margin: 0 }}>{error}</p>
        </div>
      )}

      {blueprints.length === 0 && !loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <FileText size={48} style={{ color: '#ccc', marginBottom: '1rem' }} />
          <h3>No Blueprints Yet</h3>
          <p style={{ color: '#666' }}>Create your first blueprint to get started</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {blueprints.map((blueprint) => (
            <div key={blueprint.id} className="card">
              <div className="card-header">
                <h3 className="card-title">{blueprint.name}</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => viewBlueprint(blueprint)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.875rem', padding: '0.5rem' }}
                    title="View Details"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(blueprint.id)}
                    className="btn btn-danger"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
              {blueprint.description && (
                <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  {blueprint.description}
                </p>
              )}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                marginBottom: '1rem',
                padding: '0.75rem',
                backgroundColor: 'var(--rose-100)',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}>
                <div>
                  <strong>Questions:</strong> {blueprint.total_questions || 0}
                </div>
                <div>
                  <strong>Marks:</strong> {blueprint.total_marks || 0}
                </div>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>
                <div>📅 Created: {new Date(blueprint.created_at).toLocaleDateString()}</div>
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

export default BlueprintManagement