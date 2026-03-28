import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { RefreshCw, Save, ArrowRight, ArrowLeft, CheckCircle, Plus, Trash2, Settings, X, Eye, Edit3 } from 'lucide-react'
import api from '../utils/api'
import { showToast } from '../utils/toast'
import Modal from '../components/Modal'

const QuestionGeneration = () => {
  const { subjectId } = useParams()
  const [subject, setSubject] = useState(null)
  const [units, setUnits] = useState([])
  const [topics, setTopics] = useState([])
  const [removedTopicIds, setRemovedTopicIds] = useState(() => new Set())
  const [existingBanks, setExistingBanks] = useState([])
  const [modalState, setModalState] = useState({ isOpen: false, type: '', data: null })
  const [currentPart, setCurrentPart] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showPartConfig, setShowPartConfig] = useState(false)
  const [aiProvider, setAiProvider] = useState('auto')
  const [expandedQuestions, setExpandedQuestions] = useState({})
  const [parts, setParts] = useState([])
  const [newPart, setNewPart] = useState({
    name: '',
    markPerQuestion: '',
    questionsNeeded: '',
    difficulty: 'medium',
    plan: []
  })
  const [editingPartId, setEditingPartId] = useState(null)
  const [unitRange, setUnitRange] = useState({ from: '', to: '' })

  const normalizePart = (part) => {
    const normalized = {
      ...part,
      difficulty: part.difficulty || 'medium',
      generatedQuestions: Array.isArray(part.generatedQuestions) ? part.generatedQuestions : [],
      selectedQuestions: Array.isArray(part.selectedQuestions) ? part.selectedQuestions : [],
      plan: Array.isArray(part.plan) ? part.plan : []
    }
    return normalized
  }

  const getActivePlan = () => {
    if (editingPartId !== null) {
      return parts[currentPart]?.plan || []
    }
    return newPart.plan || []
  }

  const getActivePlanTotal = () => {
    return getActivePlan().reduce((sum, row) => sum + (parseInt(row.count) || 0), 0)
  }

  const setActivePlan = (plan) => {
    if (editingPartId !== null) {
      setParts(prev => {
        const updated = [...prev]
        const part = { ...updated[currentPart], plan }
        updated[currentPart] = part
        return updated
      })
    } else {
      setNewPart(prev => ({ ...prev, plan }))
    }
  }

  const getQuestionsNeeded = (part) => {
    if (part.plan && part.plan.length > 0) {
      return part.plan.reduce((sum, row) => sum + (parseInt(row.count) || 0), 0)
    }
    return part.questionsNeeded
  }

  const hasPlanRules = (part) => Array.isArray(part?.plan) && part.plan.length > 0

  useEffect(() => {
    setParts(prev => {
      let changed = false
      const updated = prev.map(part => {
        const normalized = normalizePart(part)
        if (
          part.difficulty !== normalized.difficulty ||
          part.generatedQuestions !== normalized.generatedQuestions ||
          part.selectedQuestions !== normalized.selectedQuestions ||
          part.plan !== normalized.plan
        ) {
          changed = true
        }
        return normalized
      })
      return changed ? updated : prev
    })
  }, [])

  useEffect(() => {
    fetchSubjectData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const topicsWithSelection = response.data.topics.map(t => ({
          ...t,
          deselected: false
        }))
        setTopics(topicsWithSelection)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitRange])

  const toggleTopicSelection = (topicId) => {
    const topicToToggle = topics.find(t => t.id === topicId)
    if (!topicToToggle) return

    // If we are trying to deselect (current state is selected)
    if (!topicToToggle.deselected) {
      const selectedCount = topics.filter(t => !t.deselected).length
      if (selectedCount <= 1) {
        showToast('At least one topic must be selected', 'warning')
        return
      }
    }

    setTopics(prev => prev.map(t => 
      t.id === topicId ? { ...t, deselected: !t.deselected } : t
    ))
  }

  const toggleQuestionExpand = (questionId) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }))
  }

  const generateQuestions = async (partIndex, refresh = false) => {
    if (parts.length === 0) {
      showToast('Please add at least one part first', 'warning')
      return
    }

    if (!unitRange.from || !unitRange.to) {
      showToast('Please select unit range first', 'warning')
      return
    }

    setIsGenerating(true)

    const effectiveNeeded = getQuestionsNeeded(parts[partIndex])
    const questionsToGenerate = refresh
      ? parts[partIndex].questionsNeeded - parts[partIndex].selectedQuestions.length
      : parts[partIndex].questionsNeeded

    const selectedTopicNames = topics
      .filter(t => !t.deselected)
      .map(t => `${t.topic_name} (Unit ${t.unit_number})`)

    try {
      const response = await api.post(`/api/subjects/${subjectId}/generate-questions`, {
        from_unit: unitRange.from,
        to_unit: unitRange.to,
        count: questionsToGenerate,
        marks: parts[partIndex].markPerQuestion,
        difficulty: parts[partIndex].difficulty,
        part_name: parts[partIndex].name,
        ai_provider: aiProvider,
        topics: selectedTopicNames.length > 0 ? selectedTopicNames : null
        plan,
      })

      if (response.data.success) {
        const generatedQuestions = response.data.questions.map((q, i) => ({
          id: `${partIndex}-${i}-${Date.now()}-${Math.random()}`,
          content: q.content,
          unit: q.unit,
          topic: q.topic,
          difficulty: q.difficulty || parts[partIndex].difficulty,
          marks: q.marks || parts[partIndex].markPerQuestion,
          bloomsLevel: q.blooms_level || null,
        }))

        setParts(prev => {
          const newParts = [...prev]
          if (refresh) {
            const selectedQuestions = [...(newParts[partIndex].selectedQuestions || [])]
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
    if (parts.length === 0) {
      showToast('Please add at least one part first', 'warning')
      return
    }

    if (!unitRange.from || !unitRange.to) {
      showToast('Please select unit range first', 'warning')
      return
    }

    setIsGenerating(true)

    const selectedTopicNames = topics
      .filter(t => !t.deselected)
      .map(t => `${t.topic_name}`)

    try {
      const requests = parts.map(part => {
        const effectiveNeeded = getQuestionsNeeded(part)
        const questionsToGenerate = refresh
          ? effectiveNeeded - (part.selectedQuestions || []).length
          : effectiveNeeded

        return {
          from_unit: unitRange.from,
          to_unit: unitRange.to,
          count: questionsToGenerate,
          marks: part.markPerQuestion,
          difficulty: part.difficulty,
          part_name: part.name,
          ai_provider: aiProvider,
          plan: part.plan && part.plan.length > 0 ? part.plan : undefined,
          topics: selectedTopicNames.length > 0 ? selectedTopicNames : null
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
                marks: q.marks || newParts[partIndex].markPerQuestion,
                bloomsLevel: q.blooms_level || null,
              }))

              if (refresh) {
                const selectedQuestions = [...(newParts[partIndex].selectedQuestions || [])]
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
      const currentSelected = Array.isArray(newParts[partIndex].selectedQuestions)
        ? newParts[partIndex].selectedQuestions
        : []
      const isCurrentlySelected = currentSelected.some(q => q.id === question.id)

      if (isCurrentlySelected) {
        newParts[partIndex].selectedQuestions = currentSelected.filter(q => q.id !== question.id)
      } else {
        newParts[partIndex].selectedQuestions = [...currentSelected, question]
      }

      return newParts
    })
  }

  const saveAllPartsToQuestionBank = async () => {
    const allSelectedQuestions = []
    parts.forEach(part => {
      (part.selectedQuestions || []).forEach(q => {
        allSelectedQuestions.push({
          content: String(q.content || ""),
          part: String(part.name || ""),
          unit: q.unit ? String(q.unit) : "",
          topic: q.topic ? String(q.topic) : "",
          difficulty: q.difficulty ? String(q.difficulty) : "medium",
          marks: q.marks ? parseFloat(q.marks) : 0,
          blooms_level: q.bloomsLevel ? String(q.bloomsLevel) : null
        })
      })
    })

    if (allSelectedQuestions.length === 0) {
      showToast('Please select at least one question from any part', 'warning')
      return
    }

    if (existingBanks.length > 0) {
      const bank = existingBanks[0]

      setModalState({
        isOpen: true,
        type: 'confirm',
        title: 'Add to Question Bank',
        message: `Are you sure you want to add ${allSelectedQuestions.length} questions to the subject's question bank ("${bank.name}")?`,
        confirmText: 'Add Questions',
        onConfirm: async () => {
          try {
            const questionsToSave = allSelectedQuestions.map(q => ({
              question_bank_id: bank.id,
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
        message: `A new question bank will be created for this subject. (${allSelectedQuestions.length} questions will be saved)`,
        confirmText: 'Create & Save',
        onConfirm: async () => {
          try {
            const bankName = `${subject?.name || 'Subject'} Question Bank`
            const bankResponse = await api.post('/api/question-banks', {
              name: bankName,
              subject_id: parseInt(subjectId),
              description: `Auto-generated bank for ${subject?.name}`
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
        generatedQuestions: (part.generatedQuestions || []).filter(
          q => !(part.selectedQuestions || []).some(sq => sq.id === q.id)
        )
      }))
    })
  }

  const addPart = () => {
    console.log('addPart called with:', newPart)

    const planTotal = getActivePlanTotal()
    if (!newPart.name || !newPart.markPerQuestion || (!newPart.questionsNeeded && planTotal === 0) || !newPart.difficulty) {
      showToast('Please fill all fields including difficulty', 'warning')
      return
    }

    const questionsNeededValue = planTotal > 0 ? planTotal : parseInt(newPart.questionsNeeded)
    const totalMarks = parseFloat(newPart.markPerQuestion) * questionsNeededValue
    if (editingPartId !== null) {
      // Update existing part
      setParts(prevParts =>
        prevParts.map(part =>
          part.id === editingPartId
            ? {
                ...part,
                name: newPart.name,
                markPerQuestion: parseFloat(newPart.markPerQuestion),
                totalMarks: totalMarks,
                questionsNeeded: questionsNeededValue,
                difficulty: newPart.difficulty
              }
            : part
        )
      )
      setEditingPartId(null)
      setNewPart({ name: '', markPerQuestion: '', questionsNeeded: '', difficulty: 'medium', plan: [] })
      showToast('Part updated successfully', 'success')
    } else {
      const maxId = parts.reduce((max, part) => Math.max(max, part.id), 0)
      const newPartData = {
        id: maxId + 1,
        name: newPart.name,
        markPerQuestion: parseFloat(newPart.markPerQuestion),
        totalMarks: totalMarks,
        questionsNeeded: questionsNeededValue,
        difficulty: newPart.difficulty,
        generatedQuestions: [],
        selectedQuestions: [],
        plan: newPart.plan || []
      }

      console.log('Adding new part:', newPartData)
      setParts([...parts, newPartData])
      setNewPart({ name: '', markPerQuestion: '', questionsNeeded: '', difficulty: 'medium', plan: [] })
      setShowPartConfig(false)
      showToast('Part added successfully', 'success')
    }
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

  const startEditPart = (part) => {
    setNewPart({
      name: part.name,
      markPerQuestion: String(part.markPerQuestion),
      questionsNeeded: String(part.questionsNeeded),
      difficulty: part.difficulty,
      plan: part.plan || []
    })
    setEditingPartId(part.id)
    setShowPartConfig(true)
    const index = parts.findIndex(p => p.id === part.id)
    if (index !== -1) {
      setCurrentPart(index)
    }
  }

  const removeTopic = (topicId) => {
    const isRemoved = removedTopicIds.has(topicId)
    setRemovedTopicIds(prev => {
      const next = new Set(prev)
      if (isRemoved) {
        next.delete(topicId)
      } else {
        next.add(topicId)
      }
      return next
    })
    showToast(isRemoved ? 'Topic restored' : 'Topic removed', 'success')
  }

  const addManualTopic = (unitNumber, topicName) => {
    if (!topicName || !topicName.trim()) {
      showToast('Topic name is required', 'warning')
      return
    }

    const existingTopic = topics.find(t =>
      t.topic_name.toLowerCase() === topicName.trim().toLowerCase() &&
      t.unit_number === parseInt(unitNumber)
    )

    if (existingTopic) {
      if (removedTopicIds.has(existingTopic.id)) {
        setRemovedTopicIds(prev => {
          const next = new Set(prev)
          next.delete(existingTopic.id)
          return next
        })
        showToast('Topic restored', 'success')
      } else {
        showToast('This topic already exists', 'warning')
      }
      return
    }

    const newTopic = {
      id: `manual-${Date.now()}`,
      unit_number: parseInt(unitNumber),
      topic_name: topicName.trim(),
      deselected: false
    }

    setTopics(prev => [...prev, newTopic])
    showToast('Topic added successfully', 'success')
  }

  if (!subject) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  const currentPartData = parts[currentPart] || {
    name: '',
    markPerQuestion: 0,
    totalMarks: 0,
    questionsNeeded: 0,
    difficulty: 'medium',
    generatedQuestions: [],
    selectedQuestions: [],
    plan: []
  }
  const currentGenerated = currentPartData.generatedQuestions || []
  const currentSelected = currentPartData.selectedQuestions || []
  const totalSelectedQuestions = parts.reduce((sum, part) => {
    const selected = Array.isArray(part.selectedQuestions) ? part.selectedQuestions.length : 0
    return sum + selected
  }, 0)

  return (
    <div>
      <div className="card-header">
        <div>
          <h1 className="card-title" style={{ color: 'var(--primary-700)' }}>Generate Questions - {subject.name}</h1>
          <p style={{ color: 'var(--secondary-500)', margin: '0.5rem 0 0 0' }}>
            {subject.description}
          </p>
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
            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--secondary-600)' }}>
                Topics to be covered ({topics.length} topics):
              </h4>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {topics.map(topic => {
                const isRemoved = removedTopicIds.has(topic.id)
                return (
                <span
                  key={topic.id}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: topic.deselected ? '#e9ecef' : 'var(--primary-500)',
                    color: topic.deselected ? '#6c757d' : 'white',
                    border: topic.deselected ? '1px solid #dee2e6' : 'none',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                    cursor: 'default'
                  }}
                >
                  Unit {topic.unit_number}: {topic.topic_name}
                  <button
                    onClick={() => toggleTopicSelection(topic.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: topic.deselected ? '#6c757d' : 'white',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: topic.deselected ? '1rem' : '1.25rem',
                      lineHeight: '1',
                      fontWeight: 'bold'
                    }}
                    title={topic.deselected ? "Select topic" : "Deselect topic"}
                  >
                    {topic.deselected ? '+' : '×'}
                  </button>
                </span>
                )
              })}
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
          <div className="question-config-grid">
            <div className="form-group question-config-field">
              <label className="form-label">Part Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Part A, Part B"
                value={newPart.name}
                onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
              />
            </div>
            <div className="form-group question-config-field">
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
            <div className="form-group question-config-field">
              <label className="form-label">Number of Questions *</label>
              <input
                type="number"
                min="1"
                className="form-input"
                placeholder="e.g., 10, 20"
                value={getActivePlanTotal() > 0 ? getActivePlanTotal() : newPart.questionsNeeded}
                onChange={(e) => setNewPart({ ...newPart, questionsNeeded: e.target.value })}
                disabled={getActivePlanTotal() > 0}
              />
              {getActivePlanTotal() > 0 && (
                <div className="question-config-help" style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  Number of Questions is auto-calculated from rules.
                </div>
              )}
            </div>
            <div className="form-group question-config-field">
              <label className="form-label">Default Difficulty *</label>
              <select
                className="form-select"
                value={newPart.difficulty}
                onChange={(e) => setNewPart({ ...newPart, difficulty: e.target.value })}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <div className="question-config-help" style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#6b7280' }}>
                Used only as fallback when no per-rule difficulty is set.
              </div>
            </div>
            <div className="form-group question-config-action">
              <label className="form-label" style={{ visibility: 'hidden' }}>Action</label>
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
                {editingPartId !== null ? 'Update Part' : 'Add Part'}
              </button>
            </div>
          </div>

          {newPart.markPerQuestion && (newPart.questionsNeeded || getActivePlanTotal() > 0) && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <strong>Preview:</strong> Total marks for this part will be{' '}
              {(parseFloat(newPart.markPerQuestion) * (getActivePlanTotal() > 0 ? getActivePlanTotal() : parseInt(newPart.questionsNeeded))).toFixed(1)} marks
            </div>
          )}

          {/* Unit/Difficulty/Bloom rules for the currently selected part */}
          <div style={{ marginTop: '1.5rem' }}>
            <h4>Part Rules (Unit / Difficulty / Bloom)</h4>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.75rem' }}>
              Add per-unit rules while creating or editing the current part (<strong>{editingPartId !== null ? parts[currentPart]?.name : newPart.name || 'New Part'}</strong>).
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="part-rules-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Unit</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Difficulty</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Bloom&apos;s Level</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Count</th>
                    <th style={{ padding: '0.5rem' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {getActivePlan().map((row, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem' }}>
                        <select
                          className="form-select part-rules-control"
                          value={row.unit}
                          onChange={(e) => {
                            const value = parseInt(e.target.value)
                            const plan = [...getActivePlan()]
                            plan[idx] = { ...plan[idx], unit: value }
                            setActivePlan(plan)
                          }}
                        >
                          <option value="">Select Unit</option>
                          {(units.filter(unit => {
                            if (!unitRange.from || !unitRange.to) return true
                            const from = Number(unitRange.from)
                            const to = Number(unitRange.to)
                            return unit.unit_number >= from && unit.unit_number <= to
                          })).map(unit => (
                            <option key={unit.id} value={unit.unit_number}>
                              Unit {unit.unit_number}: {unit.unit_title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <select
                          className="form-select part-rules-control"
                          value={row.difficulty}
                          onChange={(e) => {
                            const value = e.target.value
                            const plan = [...getActivePlan()]
                            plan[idx] = { ...plan[idx], difficulty: value }
                            setActivePlan(plan)
                          }}
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <select
                          className="form-select part-rules-control"
                          value={row.blooms_level || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            const plan = [...getActivePlan()]
                            plan[idx] = { ...plan[idx], blooms_level: value }
                            setActivePlan(plan)
                          }}
                        >
                          <option value="">Select Level</option>
                          <option value="Remember">Remember</option>
                          <option value="Understand">Understand</option>
                          <option value="Apply">Apply</option>
                          <option value="Analyze">Analyze</option>
                          <option value="Evaluate">Evaluate</option>
                          <option value="Create">Create</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.5rem', width: '100px' }}>
                        <input
                          type="number"
                          min="1"
                          className="form-input part-rules-control"
                          value={row.count}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0
                            const plan = [...getActivePlan()]
                            plan[idx] = { ...plan[idx], count: value }
                            setActivePlan(plan)
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            const plan = [...getActivePlan()]
                            plan.splice(idx, 1)
                            setActivePlan(plan)
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {getActivePlan().length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#9ca3af' }}>
                        No rules defined yet. Use "Add Rule" to specify per-unit counts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  if (!units.length) {
                    showToast('Units are not loaded yet', 'warning')
                    return
                  }
                  let defaultUnit
                  if (unitRange.from && unitRange.to) {
                    const from = Number(unitRange.from)
                    const to = Number(unitRange.to)
                    const inRange = units.filter(u => u.unit_number >= from && u.unit_number <= to)
                    defaultUnit = (inRange[0] || units[0]).unit_number
                  } else {
                    defaultUnit = units[0].unit_number
                  }
                  const plan = [...getActivePlan()]
                  plan.push({
                    unit: defaultUnit,
                    difficulty: (editingPartId !== null ? parts[currentPart]?.difficulty : newPart.difficulty) || 'medium',
                    blooms_level: 'Understand',
                    count: 1
                  })
                  setActivePlan(plan)
                }}
              >
                <Plus size={14} style={{ marginRight: '0.25rem' }} />
                Add Rule
              </button>

              <div style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                Total planned questions for {editingPartId !== null ? parts[currentPart]?.name : newPart.name || 'this part'}:{' '}
                <strong>{getActivePlan().reduce((sum, row) => sum + (parseInt(row.count) || 0), 0)}</strong>
              </div>
            </div>
          </div>

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
                    <strong>{part.name}</strong> - {part.markPerQuestion} marks × {getQuestionsNeeded(part)} questions = {(part.markPerQuestion * getQuestionsNeeded(part)).toFixed(1)} marks
                    <span style={{
                      marginLeft: '0.5rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      backgroundColor: hasPlanRules(part)
                        ? '#e0ecff'
                        : ((part.difficulty || 'medium') === 'easy' ? 'var(--success-100)' : (part.difficulty || 'medium') === 'medium' ? 'var(--warning-100)' : 'var(--danger-100)'),
                      color: hasPlanRules(part)
                        ? '#1d4ed8'
                        : ((part.difficulty || 'medium') === 'easy' ? 'var(--success-700)' : (part.difficulty || 'medium') === 'medium' ? 'var(--warning-700)' : 'var(--danger-700)')
                    }}>
                      {hasPlanRules(part) ? 'Rule-based' : ((part.difficulty || 'medium').charAt(0).toUpperCase() + (part.difficulty || 'medium').slice(1))}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => startEditPart(part)}
                      className="btn btn-outline"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => deletePart(part.id)}
                      className="btn btn-danger"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {parts.length === 0 ? (
              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                No parts configured yet. Use "Configure Question Parts" above to add parts.
              </span>
            ) : (
              parts.map((part, index) => (
                <button
                  key={part.id}
                  onClick={() => setCurrentPart(index)}
                  className={`btn ${currentPart === index ? 'btn-primary' : 'btn-outline'}`}
                  style={{ position: 'relative', overflow: 'visible' }}
                >
                  {part.name}
                  <span style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      zIndex: 10,
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
                      {(part.selectedQuestions || []).length}
                    </span>
                </button>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => generateAllParts(false)}
              disabled={isGenerating || !unitRange.from || !unitRange.to || parts.length === 0}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              {isGenerating ? (
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
              ) : (
                <RefreshCw size={16} />
              )}
              Generate All
            </button>
          </div>
        </div>
      </div>

      {parts.length > 0 && currentPartData && (
        <div className="part-container">
        <div className="part-header">
          <div>
            <h3 className="part-title">{currentPartData.name}</h3>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
              {currentPartData.markPerQuestion} marks per question •
              Total: {currentPartData.totalMarks} marks •
              Need: {getQuestionsNeeded(currentPartData)} questions •
              <span style={{
                marginLeft: '0.5rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                backgroundColor: hasPlanRules(currentPartData)
                  ? '#e0ecff'
                  : ((currentPartData.difficulty || 'medium') === 'easy' ? 'var(--success-100)' : (currentPartData.difficulty || 'medium') === 'medium' ? 'var(--warning-100)' : 'var(--danger-100)'),
                color: hasPlanRules(currentPartData)
                  ? '#1d4ed8'
                  : ((currentPartData.difficulty || 'medium') === 'easy' ? 'var(--success-700)' : (currentPartData.difficulty || 'medium') === 'medium' ? 'var(--warning-700)' : 'var(--danger-700)')
              }}>
                {hasPlanRules(currentPartData)
                  ? 'Rule-based'
                  : ((currentPartData.difficulty || 'medium').charAt(0).toUpperCase() + (currentPartData.difficulty || 'medium').slice(1))}
              </span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {currentGenerated.length > 0 && (
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
                  checked={currentGenerated.length > 0 &&
                    currentSelected.length === currentGenerated.length}
                  onChange={() => {
                    const allSelected = currentSelected.length === currentGenerated.length
                    setParts(prev => {
                      const newParts = [...prev]
                      if (allSelected) {
                        newParts[currentPart].selectedQuestions = []
                      } else {
                        newParts[currentPart].selectedQuestions = [...currentGenerated]
                      }
                      return newParts
                    })
                  }}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                Select All ({currentGenerated.length})
              </label>
            )}
            <button
              onClick={() => generateQuestions(currentPart, true)}
              disabled={isGenerating || currentGenerated.length === 0}
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
          {isGenerating && currentGenerated.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem' }}></div>
              <p>Generating {currentPartData.difficulty || 'medium'} questions, please wait...</p>
            </div>
          ) : currentGenerated.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <p>No questions generated yet. Click "Generate Questions" to start.</p>
            </div>
          ) : (
            <div className="grid">
              {currentGenerated.map((question, index) => {
                const isSelected = currentSelected.some(q => q.id === question.id)
                const isExpanded = expandedQuestions[question.id]
                const rawUnit = question.unit
                const unitLabel = rawUnit
                  ? (String(rawUnit).toLowerCase().startsWith('unit') ? String(rawUnit) : `Unit ${rawUnit}`)
                  : null

                return (
                  <div
                    key={question.id}
                    className={`question-item ${isSelected ? 'selected' : ''}`}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--success-100, #dcfce7)' : 'white',
                      borderColor: isSelected ? 'var(--success-500, #22c55e)' : 'var(--secondary-200)',
                      transition: 'all 0.2s ease'
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
                            {unitLabel && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--secondary-600)', fontSize: '0.85rem' }}>
                                📘 <span style={{ fontWeight: '500' }}>{unitLabel}</span>
                              </span>
                            )}
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
                            {question.bloomsLevel && (
                              <span style={{
                                padding: '0.25rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                backgroundColor: '#e0ecff',
                                color: '#1d4ed8',
                                textTransform: 'capitalize',
                                letterSpacing: '0.02em'
                              }}>
                                🎓 {question.bloomsLevel}
                              </span>
                            )}
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
      )}

      <div className="card">
        <h3>Generation Progress</h3>
        <div className="grid grid-3">
          {parts.map((part, index) => (
            <div 
              key={part.id} 
              onClick={() => setCurrentPart(index)}
              style={{
                padding: '1rem',
                border: index === currentPart ? '2px solid var(--primary-500)' : '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: index === currentPart ? '#f8f9ff' : 'white',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: index === currentPart ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
              }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>
                {part.name}
                <span style={{
                  marginLeft: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  backgroundColor: hasPlanRules(part)
                    ? '#e0ecff'
                    : ((part.difficulty || 'medium') === 'easy' ? 'var(--success-100)' : (part.difficulty || 'medium') === 'medium' ? 'var(--warning-100)' : 'var(--danger-100)'),
                  color: hasPlanRules(part)
                    ? '#1d4ed8'
                    : ((part.difficulty || 'medium') === 'easy' ? 'var(--success-700)' : (part.difficulty || 'medium') === 'medium' ? 'var(--warning-700)' : 'var(--danger-700)')
                }}>
                  {hasPlanRules(part)
                    ? 'Rule-based'
                    : ((part.difficulty || 'medium').charAt(0).toUpperCase() + (part.difficulty || 'medium').slice(1))}
                </span>
              </h4>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>
                <div>Selected: {(part.selectedQuestions || []).length}/{part.questionsNeeded}</div>
                  <div>Generated: {(part.generatedQuestions || []).length}</div>
                  <div>Marks: {part.markPerQuestion} × {getQuestionsNeeded(part)} = {part.totalMarks}</div>
              </div>
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#e5e5e5',
                borderRadius: '2px',
                marginTop: '0.5rem'
              }}>
                <div style={{
                  width: `${(getQuestionsNeeded(part) ? ((part.selectedQuestions || []).length / getQuestionsNeeded(part)) * 100 : 0)}%`,
                  height: '100%',
                  backgroundColor: '#28a745',
                  borderRadius: '2px',
                  transition: 'width 0.3s'
                }}></div>
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
          <button
            onClick={saveAllPartsToQuestionBank}
            disabled={totalSelectedQuestions === 0}
            className="btn btn-success"
            style={{ 
              padding: '0.75rem 2rem', 
              fontSize: '1rem', 
              width: '100%', 
              maxWidth: '400px', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '0.5rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          >
            <Save size={20} />
            Save All Generated Questions ({totalSelectedQuestions})
          </button>
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