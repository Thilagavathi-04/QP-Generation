import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { RefreshCw, Save, ArrowRight, ArrowLeft, CheckCircle, Plus, Trash2, Settings, X, Eye } from 'lucide-react'
import api from '../utils/api'
import { showToast } from '../components/Toast'
import Modal from '../components/Modal'

const QuestionGeneration = () => {
  const { subjectId } = useParams()
  const [subject, setSubject] = useState(null)
  const [units, setUnits] = useState([])
  const [topics, setTopics] = useState([])
  const [existingBanks, setExistingBanks] = useState([])
  const [saveMode, setSaveMode] = useState('new') // 'new' or 'existing'
  const [selectedBankId, setSelectedBankId] = useState('')
  const [modalState, setModalState] = useState({ isOpen: false, type: '', data: null })
  const [currentPart, setCurrentPart] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showPartConfig, setShowPartConfig] = useState(false)
  const [aiProvider, setAiProvider] = useState('auto')
  const [expandedQuestions, setExpandedQuestions] = useState({})
  const [parts, setParts] = useState([
    {
      id: 1,
      name: 'Part A',
      markPerQuestion: 0.5,
      totalMarks: 6,
      questionsNeeded: 12,
      difficulty: 'easy',
      generatedQuestions: [],
      selectedQuestions: []
    },
    {
      id: 2,
      name: 'Part B',
      markPerQuestion: 2,
      totalMarks: 16,
      questionsNeeded: 8,
      difficulty: 'medium',
      generatedQuestions: [],
      selectedQuestions: []
    },
    {
      id: 3,
      name: 'Part C',
      markPerQuestion: 5,
      totalMarks: 15,
      questionsNeeded: 3,
      difficulty: 'hard',
      generatedQuestions: [],
      selectedQuestions: []
    }
  ])
  const [newPart, setNewPart] = useState({
    name: '',
    markPerQuestion: '',
    questionsNeeded: '',
    difficulty: 'medium'
  })
  const [unitRange, setUnitRange] = useState({ from: '', to: '' })

  useEffect(() => {
    fetchSubjectData()
  }, [subjectId])

  const fetchSubjectData = async () => {
    try {
      const subjectResponse = await api.get(`/api/subjects/${subjectId}`)
      setSubject(subjectResponse.data)

      const unitsResponse = await api.get(`/api/subjects/${subjectId}/units`)
      setUnits(unitsResponse.data.units)

      if (unitsResponse.data.units.length > 0) {
        const firstUnit = unitsResponse.data.units[0].unit_number
        const lastUnit = unitsResponse.data.units[unitsResponse.data.units.length - 1].unit_number
        setUnitRange({ from: firstUnit, to: lastUnit })
      }

      // Fetch existing question banks
      const banksResponse = await api.get(`/api/question-banks/subject/${subjectId}`)
      setExistingBanks(banksResponse.data)
      if (banksResponse.data.length > 0) {
        setSelectedBankId(banksResponse.data[0].id)
      }
    } catch (error) {
      console.error('Error fetching subject data:', error)
      showToast('Failed to fetch subject data', 'error')
    }
  }

  const fetchTopics = async () => {
    if (unitRange.from && unitRange.to) {
      try {
        const response = await api.get(`/api/subjects/${subjectId}/topics`, {
          params: {
            from_unit: unitRange.from,
            to_unit: unitRange.to
          }
        })
        setTopics(response.data.topics)
      } catch (error) {
        console.error('Error fetching topics:', error)
        showToast('Failed to fetch topics', 'error')
      }
    }
  }

  useEffect(() => {
    if (unitRange.from && unitRange.to) {
      fetchTopics()
    }
  }, [unitRange])

  const toggleQuestionExpand = (questionId) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }))
  }

  const generateQuestions = async (partIndex, refresh = false) => {
    if (!unitRange.from || !unitRange.to) {
      showToast('Please select unit range first', 'warning')
      return
    }

    setIsGenerating(true)

    const questionsToGenerate = refresh
      ? parts[partIndex].questionsNeeded - parts[partIndex].selectedQuestions.length
      : parts[partIndex].questionsNeeded

    try {
      const response = await api.post(`/api/subjects/${subjectId}/generate-questions`, {
        from_unit: unitRange.from,
        to_unit: unitRange.to,
        count: questionsToGenerate,
        marks: parts[partIndex].markPerQuestion,
        difficulty: parts[partIndex].difficulty,
        part_name: parts[partIndex].name,
        ai_provider: aiProvider,
      })

      if (response.data.success) {
        const generatedQuestions = response.data.questions.map((q, i) => ({
          id: `${partIndex}-${i}-${Date.now()}-${Math.random()}`,
          content: q.content,
          unit: q.unit,
          topic: q.topic,
          difficulty: q.difficulty || parts[partIndex].difficulty,
          marks: q.marks || parts[partIndex].markPerQuestion
        }))

        setParts(prev => {
          const newParts = [...prev]
          if (refresh) {
            const selectedQuestions = [...newParts[partIndex].selectedQuestions]
            newParts[partIndex].generatedQuestions = [...selectedQuestions, ...generatedQuestions]
          } else {
            newParts[partIndex].generatedQuestions = generatedQuestions
            newParts[partIndex].selectedQuestions = []
          }
          return newParts
        })

        showToast(`Generated ${generatedQuestions.length} questions successfully!`, 'success')
      }
    } catch (error) {
      console.error('Error generating questions:', error)
      showToast('Failed to generate questions: ' + (error.response?.data?.detail || 'Unknown error. Check provider key/model configuration.'), 'error', 5000)
    } finally {
      setIsGenerating(false)
    }
  }

  const generateAllParts = async (refresh = false) => {
    if (!unitRange.from || !unitRange.to) {
      showToast('Please select unit range first', 'warning')
      return
    }

    setIsGenerating(true)

    try {
      const requests = parts.map(part => {
        const questionsToGenerate = refresh
          ? part.questionsNeeded - part.selectedQuestions.length
          : part.questionsNeeded

        return {
          from_unit: unitRange.from,
          to_unit: unitRange.to,
          count: questionsToGenerate,
          marks: part.markPerQuestion,
          difficulty: part.difficulty,
          part_name: part.name,
          ai_provider: aiProvider,
        }
      })

      const response = await api.post(`/api/subjects/${subjectId}/generate-all-questions`, requests)

      if (response.data.success) {
        setParts(prev => {
          const newParts = [...prev]

          response.data.parts.forEach((partResult, partIndex) => {
            if (partResult.success) {
              const generatedQuestions = partResult.questions.map((q, i) => ({
                id: `${partIndex}-${i}-${Date.now()}-${Math.random()}`,
                content: q.content,
                unit: q.unit,
                topic: q.topic,
                difficulty: q.difficulty || newParts[partIndex].difficulty,
                marks: q.marks || newParts[partIndex].markPerQuestion
              }))

              if (refresh) {
                const selectedQuestions = [...newParts[partIndex].selectedQuestions]
                newParts[partIndex].generatedQuestions = [...selectedQuestions, ...generatedQuestions]
              } else {
                newParts[partIndex].generatedQuestions = generatedQuestions
                newParts[partIndex].selectedQuestions = []
              }
            }
          })

          return newParts
        })

        showToast(`Generated questions for ${response.data.parts.filter(p => p.success).length} parts successfully!`, 'success')
      }
    } catch (error) {
      console.error('Error generating all questions:', error)
      showToast('Failed to generate questions: ' + (error.response?.data?.detail || 'Unknown error. Check provider key/model configuration.'), 'error', 5000)
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleQuestionSelection = (partIndex, question) => {
    setParts(prev => {
      const newParts = [...prev]
      const isCurrentlySelected = newParts[partIndex].selectedQuestions.some(q => q.id === question.id)

      if (isCurrentlySelected) {
        newParts[partIndex].selectedQuestions = newParts[partIndex].selectedQuestions.filter(q => q.id !== question.id)
      } else {
        newParts[partIndex].selectedQuestions = [...newParts[partIndex].selectedQuestions, question]
      }

      return newParts
    })
  }

  const saveAllPartsToQuestionBank = async () => {
    const allSelectedQuestions = []
    parts.forEach(part => {
      part.selectedQuestions.forEach(q => {
        allSelectedQuestions.push({
          content: String(q.content || ""),
          part: String(part.name || ""),
          unit: q.unit ? String(q.unit) : "",
          topic: q.topic ? String(q.topic) : "",
          difficulty: q.difficulty ? String(q.difficulty) : "medium",
          marks: q.marks ? parseFloat(q.marks) : 0
        })
      })
    })

    if (allSelectedQuestions.length === 0) {
      showToast('Please select at least one question from any part', 'warning')
      return
    }

    if (saveMode === 'existing') {
      if (!selectedBankId) {
        showToast('Please select a question bank', 'warning')
        return
      }

      const bank = existingBanks.find(b => b.id === parseInt(selectedBankId))

      setModalState({
        isOpen: true,
        type: 'confirm',
        title: 'Add to Existing Bank',
        message: `Are you sure you want to add ${allSelectedQuestions.length} questions to "${bank?.name}"?`,
        confirmText: 'Add Questions',
        onConfirm: async () => {
          try {
            const questionsToSave = allSelectedQuestions.map(q => ({
              question_bank_id: parseInt(selectedBankId),
              subject_id: parseInt(subjectId),
              ...q
            }))

            const response = await api.post('/api/questions/batch', questionsToSave)

            if (response.data.success) {
              showToast(`Added ${response.data.count} questions to "${bank.name}" successfully!`, 'success')
              resetSelectedAfterSave()
            }
          } catch (error) {
            console.error('Error saving to existing bank:', error)
            showToast('Failed to save questions: ' + (error.response?.data?.detail || 'Unknown error'), 'error')
          }
        }
      })
    } else {
      setModalState({
        isOpen: true,
        type: 'confirm',
        title: 'Create Question Bank',
        message: `Enter a name for the question bank (${allSelectedQuestions.length} questions will be saved):`,
        showInput: true,
        inputPlaceholder: 'Enter question bank name...',
        defaultValue: `Question Bank - ${new Date().toLocaleDateString()}`,
        confirmText: 'Create',
        onConfirm: async (bankName) => {
          if (!bankName || !bankName.trim()) {
            showToast('Question bank name is required', 'warning')
            return
          }

          try {
            const bankResponse = await api.post('/api/question-banks', {
              name: bankName.trim(),
              subject_id: parseInt(subjectId),
              description: `Generated on ${new Date().toLocaleString()} with ${allSelectedQuestions.length} questions`
            })

            const questionBankId = bankResponse.data.id

            const questionsToSave = allSelectedQuestions.map(q => ({
              question_bank_id: questionBankId,
              subject_id: parseInt(subjectId),
              ...q
            }))

            const response = await api.post('/api/questions/batch', questionsToSave)

            if (response.data.success) {
              showToast(`Question Bank "${bankName}" created successfully with ${response.data.count} questions!`, 'success')
              resetSelectedAfterSave()
              // Refresh banks list
              fetchSubjectData()
            }
          } catch (error) {
            console.error('Error saving questions:', error)
            showToast('Failed to save questions: ' + (error.response?.data?.detail || 'Unknown error'), 'error')
          }
        }
      })
    }
  }

  const resetSelectedAfterSave = () => {
    setParts(prev => {
      return prev.map(part => ({
        ...part,
        selectedQuestions: [],
        generatedQuestions: part.generatedQuestions.filter(
          q => !part.selectedQuestions.some(sq => sq.id === q.id)
        )
      }))
    })
  }

  const addPart = () => {
    console.log('addPart called with:', newPart)

    if (!newPart.name || !newPart.markPerQuestion || !newPart.questionsNeeded || !newPart.difficulty) {
      showToast('Please fill all fields including difficulty', 'warning')
      return
    }

    const totalMarks = parseFloat(newPart.markPerQuestion) * parseInt(newPart.questionsNeeded)
    const newPartData = {
      id: parts.length + 1,
      name: newPart.name,
      markPerQuestion: parseFloat(newPart.markPerQuestion),
      totalMarks: totalMarks,
      questionsNeeded: parseInt(newPart.questionsNeeded),
      difficulty: newPart.difficulty,
      generatedQuestions: [],
      selectedQuestions: []
    }

    console.log('Adding new part:', newPartData)
    setParts([...parts, newPartData])
    setNewPart({ name: '', markPerQuestion: '', questionsNeeded: '', difficulty: 'medium' })
    setShowPartConfig(false)
    showToast('Part added successfully', 'success')
  }

  const deletePart = (partId) => {
    if (parts.length === 1) {
      showToast('Cannot delete the last part', 'warning')
      return
    }
    setModalState({
      isOpen: true,
      type: 'danger',
      title: 'Delete Part',
      message: 'Are you sure you want to delete this part? This action cannot be undone.',
      confirmText: 'Delete',
      onConfirm: () => {
        const newParts = parts.filter(p => p.id !== partId)
        setParts(newParts)
        if (currentPart >= newParts.length) {
          setCurrentPart(Math.max(0, newParts.length - 1))
        }
        showToast('Part deleted successfully', 'success')
      }
    })
  }

  const updatePartDifficulty = (partIndex, difficulty) => {
    setParts(prev => {
      const newParts = [...prev]
      newParts[partIndex].difficulty = difficulty
      return newParts
    })
  }

  const removeTopic = (topicId) => {
    setTopics(prev => prev.filter(t => t.id !== topicId))
    showToast('Topic removed', 'success')
  }

  const addManualTopic = (unitNumber, topicName) => {
    if (!topicName || !topicName.trim()) {
      showToast('Topic name is required', 'warning')
      return
    }

    const exists = topics.some(t =>
      t.topic_name.toLowerCase() === topicName.trim().toLowerCase() &&
      t.unit_number === parseInt(unitNumber)
    )

    if (exists) {
      showToast('This topic already exists', 'warning')
      return
    }

    const newTopic = {
      id: `manual-${Date.now()}`,
      unit_number: parseInt(unitNumber),
      topic_name: topicName.trim()
    }

    setTopics(prev => [...prev, newTopic])
    showToast('Topic added successfully', 'success')
  }

  const nextPart = () => {
    if (currentPart < parts.length - 1) {
      setCurrentPart(currentPart + 1)
    }
  }

  const prevPart = () => {
    if (currentPart > 0) {
      setCurrentPart(currentPart - 1)
    }
  }

  if (!subject) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  const currentPartData = parts[currentPart]
  const totalSelectedQuestions = parts.reduce((sum, part) => sum + part.selectedQuestions.length, 0)

  return (
    <div>
      <div className="card-header">
        <div>
          <h1 className="card-title" style={{ color: 'var(--primary-700)' }}>Generate Questions - {subject.name}</h1>
          <p style={{ color: 'var(--secondary-500)', margin: '0.5rem 0 0 0' }}>
            {subject.description}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => generateAllParts(false)}
            disabled={isGenerating || !unitRange.from || !unitRange.to}
            className="btn btn-primary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
          >
            {isGenerating ? (
              <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
            ) : (
              <RefreshCw size={14} />
            )}
            Generate All
          </button>
          <button
            onClick={() => generateAllParts(true)}
            disabled={isGenerating || !unitRange.from || !unitRange.to}
            className="btn btn-warning"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
          >
            {isGenerating ? (
              <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
            ) : (
              <RefreshCw size={14} />
            )}
            Refresh All
          </button>
          <button
            onClick={saveAllPartsToQuestionBank}
            disabled={totalSelectedQuestions === 0}
            className="btn btn-success"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
          >
            <Save size={14} />
            Save All ({totalSelectedQuestions})
          </button>
          <Link to="/subjects" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}>Back</Link>
        </div>
      </div>

      <div className="card" style={{ borderLeft: '4px solid #28a745' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--success-600)' }}>Save Options</h4>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--secondary-500)' }}>
              Choose whether to create a new question bank or add to an existing one.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#e9ecef', padding: '0.25rem', borderRadius: '4px' }}>
              <button
                onClick={() => setSaveMode('new')}
                className={`btn btn-sm ${saveMode === 'new' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.25rem 0.75rem' }}
              >
                New Bank
              </button>
              <button
                onClick={() => setSaveMode('existing')}
                className={`btn btn-sm ${saveMode === 'existing' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.25rem 0.75rem' }}
                disabled={existingBanks.length === 0}
              >
                Existing Bank
              </button>
            </div>

            {saveMode === 'existing' && (
              <select
                className="form-select"
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', minWidth: '200px' }}
              >
                {existingBanks.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.name} ({bank.total_questions} questions)</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Question Generation Range</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">From Unit</label>
            <select
              className="form-select"
              value={unitRange.from}
              onChange={(e) => setUnitRange(prev => ({ ...prev, from: parseInt(e.target.value) }))}
            >
              <option value="">Select Unit</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.unit_number}>
                  Unit {unit.unit_number}: {unit.unit_title}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">To Unit</label>
            <select
              className="form-select"
              value={unitRange.to}
              onChange={(e) => setUnitRange(prev => ({ ...prev, to: parseInt(e.target.value) }))}
            >
              <option value="">Select Unit</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.unit_number}>
                  Unit {unit.unit_number}: {unit.unit_title}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">AI Provider</label>
            <select
              className="form-select"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
            >
              <option value="auto">Auto (use AI_MODE)</option>
              <option value="ollama">Ollama (Offline)</option>
              <option value="xai">xAI (Online)</option>
              <option value="openai">OpenAI (Online)</option>
              <option value="gemini">Gemini (Online)</option>
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                console.log('Configure Parts clicked, current state:', showPartConfig)
                setShowPartConfig(!showPartConfig)
              }}
              className="btn btn-outline"
              style={{ width: '100%' }}
            >
              <Settings size={16} />
              {showPartConfig ? 'Hide Configuration' : 'Configure Parts'}
            </button>
          </div>
        </div>

        {topics.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--secondary-600)' }}>
                Topics to be covered ({topics.length} topics):
              </h4>
              <button
                onClick={() => setModalState({
                  isOpen: true,
                  type: 'custom',
                  title: 'Add Topic Manually',
                  data: { unitNumber: '', topicName: '' }
                })}
                className="btn btn-sm btn-outline"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              >
                <Plus size={14} style={{ marginRight: '0.25rem' }} />
                Add Topic
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {topics.map(topic => (
                <span
                  key={topic.id}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: 'var(--primary-500)',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  Unit {topic.unit_number}: {topic.topic_name}
                  <button
                    onClick={() => removeTopic(topic.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '1.25rem',
                      lineHeight: '1'
                    }}
                    title="Remove topic"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {subject.use_book_for_generation && (
          <div className="alert alert-success" style={{ marginTop: '1rem' }}>
            Questions will be generated from the uploaded reference book
          </div>
        )}
      </div>

      {showPartConfig && (
        <div className="card">
          <h3>Configure Question Parts</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Part Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Part A, Part B"
                value={newPart.name}
                onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Marks per Question *</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                className="form-input"
                placeholder="e.g., 0.5, 2, 5"
                value={newPart.markPerQuestion}
                onChange={(e) => setNewPart({ ...newPart, markPerQuestion: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Number of Questions *</label>
              <input
                type="number"
                min="1"
                className="form-input"
                placeholder="e.g., 10, 20"
                value={newPart.questionsNeeded}
                onChange={(e) => setNewPart({ ...newPart, questionsNeeded: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Difficulty *</label>
              <select
                className="form-select"
                value={newPart.difficulty}
                onChange={(e) => setNewPart({ ...newPart, difficulty: e.target.value })}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  addPart()
                }}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                <Plus size={16} />
                Add Part
              </button>
            </div>
          </div>

          {newPart.markPerQuestion && newPart.questionsNeeded && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <strong>Preview:</strong> Total marks for this part will be{' '}
              {(parseFloat(newPart.markPerQuestion) * parseInt(newPart.questionsNeeded)).toFixed(1)} marks
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <h4>Current Parts</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {parts.map((part) => (
                <div
                  key={part.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    border: '1px solid #dee2e6'
                  }}
                >
                  <div>
                    <strong>{part.name}</strong> - {part.markPerQuestion} marks × {part.questionsNeeded} questions = {part.totalMarks} marks
                    <span style={{
                      marginLeft: '0.5rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      backgroundColor: part.difficulty === 'easy' ? 'var(--success-100)' : part.difficulty === 'medium' ? 'var(--warning-100)' : 'var(--danger-100)',
                      color: part.difficulty === 'easy' ? 'var(--success-700)' : part.difficulty === 'medium' ? 'var(--warning-700)' : 'var(--danger-700)'
                    }}>
                      {part.difficulty.charAt(0).toUpperCase() + part.difficulty.slice(1)}
                    </span>
                  </div>
                  <button
                    onClick={() => deletePart(part.id)}
                    className="btn btn-danger"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {parts.map((part, index) => (
              <button
                key={part.id}
                onClick={() => setCurrentPart(index)}
                className={`btn ${currentPart === index ? 'btn-primary' : 'btn-outline'}`}
                style={{ position: 'relative' }}
              >
                {part.name}
                {part.selectedQuestions.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {part.selectedQuestions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={prevPart}
              disabled={currentPart === 0}
              className="btn btn-secondary"
            >
              <ArrowLeft size={16} /> Previous
            </button>
            <button
              onClick={nextPart}
              disabled={currentPart === parts.length - 1}
              className="btn btn-secondary"
            >
              Next <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="part-container">
        <div className="part-header">
          <div>
            <h3 className="part-title">{currentPartData.name}</h3>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
              {currentPartData.markPerQuestion} marks per question •
              Total: {currentPartData.totalMarks} marks •
              Need: {currentPartData.questionsNeeded} questions •
              <span style={{
                marginLeft: '0.5rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                backgroundColor: currentPartData.difficulty === 'easy' ? 'var(--success-100)' : currentPartData.difficulty === 'medium' ? 'var(--warning-100)' : 'var(--danger-100)',
                color: currentPartData.difficulty === 'easy' ? 'var(--success-700)' : currentPartData.difficulty === 'medium' ? 'var(--warning-700)' : 'var(--danger-700)'
              }}>
                {currentPartData.difficulty.charAt(0).toUpperCase() + currentPartData.difficulty.slice(1)}
              </span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Difficulty:</label>
              <select
                className="form-select"
                value={currentPartData.difficulty}
                onChange={(e) => updatePartDifficulty(currentPart, e.target.value)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            {currentPartData.generatedQuestions.length > 0 && (
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                <input
                  type="checkbox"
                  checked={currentPartData.generatedQuestions.length > 0 &&
                    currentPartData.selectedQuestions.length === currentPartData.generatedQuestions.length}
                  onChange={(e) => {
                    const allSelected = currentPartData.selectedQuestions.length === currentPartData.generatedQuestions.length
                    setParts(prev => {
                      const newParts = [...prev]
                      if (allSelected) {
                        newParts[currentPart].selectedQuestions = []
                      } else {
                        newParts[currentPart].selectedQuestions = [...currentPartData.generatedQuestions]
                      }
                      return newParts
                    })
                  }}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                Select All ({currentPartData.generatedQuestions.length})
              </label>
            )}
            <button
              onClick={() => generateQuestions(currentPart, true)}
              disabled={isGenerating || currentPartData.generatedQuestions.length === 0}
              className="btn btn-warning"
            >
              {isGenerating ? (
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
              ) : (
                <RefreshCw size={16} />
              )}
              Refresh Unselected
            </button>
            <button
              onClick={() => generateQuestions(currentPart, false)}
              disabled={isGenerating}
              className="btn btn-primary"
            >
              {isGenerating ? (
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
              ) : (
                'Generate Questions'
              )}
            </button>
          </div>
        </div>

        <div className="part-content">
          {isGenerating && currentPartData.generatedQuestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem' }}></div>
              <p>Generating {currentPartData.difficulty} questions, please wait...</p>
            </div>
          ) : currentPartData.generatedQuestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <p>No questions generated yet. Click "Generate Questions" to start.</p>
            </div>
          ) : (
            <div className="grid">
              {currentPartData.generatedQuestions.map((question, index) => {
                const isSelected = currentPartData.selectedQuestions.some(q => q.id === question.id)
                const isExpanded = expandedQuestions[question.id]

                return (
                  <div
                    key={question.id}
                    className={`question-item ${isSelected ? 'selected' : ''}`}
                    style={{
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleQuestionSelection(currentPart, question)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="question-content" style={{ flex: 1, marginRight: '1rem' }}>
                          <strong>Q{index + 1}:</strong> {isExpanded ? question.content : question.content.slice(0, 150) + (question.content.length > 150 ? '...' : '')}
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            toggleQuestionExpand(question.id)
                          }}
                          className="btn-icon"
                          style={{
                            padding: '0.4rem',
                            background: isExpanded ? 'var(--primary-50)' : '#f8f9fa',
                            borderRadius: '8px',
                            border: '1px solid ' + (isExpanded ? 'var(--primary-200)' : 'var(--secondary-200)')
                          }}
                          title={isExpanded ? 'Hide details' : 'Show details'}
                        >
                          <Eye size={18} style={{ color: isExpanded ? 'var(--primary-600)' : '#666' }} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="question-meta" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--secondary-100)' }}>
                          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                            {question.topic && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--secondary-600)', fontSize: '0.85rem' }}>
                                📚 <span style={{ fontWeight: '500' }}>{question.topic}</span>
                              </span>
                            )}
                            <span style={{
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              backgroundColor: question.difficulty === 'easy' ? 'var(--success-100)' : question.difficulty === 'medium' ? 'var(--warning-100)' : 'var(--danger-100)',
                              color: question.difficulty === 'easy' ? 'var(--success-700)' : question.difficulty === 'medium' ? 'var(--warning-700)' : 'var(--danger-700)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.025em'
                            }}>
                              ⭐ {question.difficulty}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-600)', fontSize: '0.85rem', fontWeight: '600' }}>
                              🎯 {question.marks} marks
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Generation Progress</h3>
        <div className="grid grid-3">
          {parts.map((part, index) => (
            <div key={part.id} style={{
              padding: '1rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: index === currentPart ? '#f8f9ff' : 'white'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>
                {part.name}
                <span style={{
                  marginLeft: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  backgroundColor: part.difficulty === 'easy' ? 'var(--success-100)' : part.difficulty === 'medium' ? 'var(--warning-100)' : 'var(--danger-100)',
                  color: part.difficulty === 'easy' ? 'var(--success-700)' : part.difficulty === 'medium' ? 'var(--warning-700)' : 'var(--danger-700)'
                }}>
                  {part.difficulty.charAt(0).toUpperCase() + part.difficulty.slice(1)}
                </span>
              </h4>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>
                <div>Selected: {part.selectedQuestions.length}/{part.questionsNeeded}</div>
                <div>Generated: {part.generatedQuestions.length}</div>
                <div>Marks: {part.markPerQuestion} × {part.questionsNeeded} = {part.totalMarks}</div>
              </div>
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#e5e5e5',
                borderRadius: '2px',
                marginTop: '0.5rem'
              }}>
                <div style={{
                  width: `${(part.selectedQuestions.length / part.questionsNeeded) * 100}%`,
                  height: '100%',
                  backgroundColor: '#28a745',
                  borderRadius: '2px',
                  transition: 'width 0.3s'
                }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        isOpen={modalState.isOpen && modalState.type !== 'custom'}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText || 'Confirm'}
        type={modalState.type}
        showInput={modalState.showInput}
        inputPlaceholder={modalState.inputPlaceholder}
        defaultValue={modalState.defaultValue}
      />

      {/* Add Topic Modal */}
      {modalState.isOpen && modalState.type === 'custom' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setModalState({ ...modalState, isOpen: false })}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '1rem'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                Add Topic Manually
              </h3>
              <button
                onClick={() => setModalState({ ...modalState, isOpen: false })}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  color: '#6b7280',
                  fontSize: '1.5rem',
                  lineHeight: '1',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.color = '#ef4444'}
                onMouseLeave={(e) => e.target.style.color = '#6b7280'}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Unit Number: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={modalState.data?.unitNumber || ''}
                  onChange={(e) => setModalState({
                    ...modalState,
                    data: { ...modalState.data, unitNumber: parseInt(e.target.value) }
                  })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">Select Unit</option>
                  {units.map(unit => (
                    <option key={unit.id} value={unit.unit_number}>
                      Unit {unit.unit_number}: {unit.unit_title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Topic Name: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter topic name..."
                  value={modalState.data?.topicName || ''}
                  onChange={(e) => setModalState({
                    ...modalState,
                    data: { ...modalState.data, topicName: e.target.value }
                  })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '1rem'
                  }}
                />
                <p style={{
                  fontSize: '0.875rem',
                  color: '#6b7280',
                  marginTop: '0.5rem',
                  marginBottom: 0
                }}>
                  Example: Searching, Linear Search, Binary Trees, etc.
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
              paddingTop: '1rem',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                onClick={() => setModalState({ ...modalState, isOpen: false })}
                className="btn btn-secondary"
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const unitNumber = modalState.data?.unitNumber
                  const topicName = modalState.data?.topicName

                  if (!unitNumber || !topicName) {
                    showToast('Please fill all fields', 'warning')
                    return
                  }

                  addManualTopic(unitNumber, topicName)
                  setModalState({ ...modalState, isOpen: false, data: null })
                }}
                className="btn btn-primary"
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}
              >
                Add Topic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuestionGeneration