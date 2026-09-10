import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Search, Filter, Download, Trash2, Eye, EyeOff, Database, ArrowLeft, BookOpen } from 'lucide-react'
import api from '../utils/api'
import { showToast } from '../utils/toast'
import Modal from '../components/Modal'

const QuestionBank = () => {
  const { subjectId } = useParams()
  const [banks, setBanks] = useState([])
  const [selectedBank, setSelectedBank] = useState(null)
  const [subject, setSubject] = useState(null)
  const [questions, setQuestions] = useState([])
  const [filteredQuestions, setFilteredQuestions] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [modalState, setModalState] = useState({ isOpen: false, type: '', data: null })
  const [filters, setFilters] = useState({
    part: 'all',
    unit: 'all',
    difficulty: 'all',
    marks: 'all'
  })
  const [selectedQuestions, setSelectedQuestions] = useState([])
  const [expandedQuestions, setExpandedQuestions] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Teacher Question Management Modals
  const [showAddManualModal, setShowAddManualModal] = useState(false)
  const [manualQuestion, setManualQuestion] = useState({
    content: '',
    unit: '1',
    topic: '',
    difficulty: 'medium',
    marks: 2,
    source: 'teacher'
  })
  const [manualSaving, setManualSaving] = useState(false)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [parsingFile, setParsingFile] = useState(false)
  const [parsedQuestions, setParsedQuestions] = useState([])
  const [savingBatch, setSavingBatch] = useState(false)

  useEffect(() => {
    if (subjectId) {
      fetchSubjectData()
      fetchBanksBySubject(subjectId)
    } else {
      fetchAllBanks()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId])

  const fetchSubjectData = async () => {
    try {
      const response = await api.get(`/api/subjects/${subjectId}`)
      setSubject(response.data)
    } catch (err) {
      console.error('Error fetching subject:', err)
    }
  }

  const fetchAllBanks = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/question-banks')
      setBanks(response.data)
    } catch (err) {
      console.error('Error fetching banks:', err)
      setError('Failed to load question banks')
    } finally {
      setLoading(false)
    }
  }

  const fetchBanksBySubject = async (sid) => {
    try {
      setLoading(true)
      const response = await api.get(`/api/question-banks/subject/${sid}`)
      setBanks(response.data)
    } catch (err) {
      console.error('Error fetching banks for subject:', err)
      setError('Failed to load question banks')
    } finally {
      setLoading(false)
    }
  }

  const fetchBankQuestions = async (bank) => {
    try {
      setLoading(true)
      setSelectedBank(bank)
      const response = await api.get(`/api/questions/bank/${bank.id}`)
      setQuestions(response.data)
      setFilteredQuestions(response.data)

      // Also fetch subject if not already fetched
      if (!subject || subject.id !== bank.subject_id) {
        const subjectResponse = await api.get(`/api/subjects/${bank.subject_id}`)
        setSubject(subjectResponse.data)
      }
    } catch (err) {
      console.error('Error fetching questions for bank:', err)
      showToast('Failed to load questions for this bank', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedBank) return

    let filtered = questions

    if (searchTerm) {
      filtered = filtered.filter(q =>
        q.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.topic && q.topic.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (q.unit && q.unit.toString().toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (filters.part !== 'all') {
      filtered = filtered.filter(q => q.part === filters.part)
    }
    if (filters.unit !== 'all') {
      filtered = filtered.filter(q => q.unit === filters.unit)
    }
    if (filters.difficulty !== 'all') {
      filtered = filtered.filter(q => q.difficulty && q.difficulty.toLowerCase() === filters.difficulty.toLowerCase())
    }
    if (filters.marks !== 'all') {
      filtered = filtered.filter(q => q.marks.toString() === filters.marks)
    }

    setFilteredQuestions(filtered)
  }, [searchTerm, filters, questions, selectedBank])

  const toggleQuestionExpand = (questionId) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }))
  }

  const toggleQuestionSelection = (question) => {
    setSelectedQuestions(prev => {
      const isSelected = prev.some(q => q.id === question.id)
      if (isSelected) {
        return prev.filter(q => q.id !== question.id)
      } else {
        return [...prev, question]
      }
    })
  }

  const deleteQuestion = (questionId) => {
    setModalState({
      isOpen: true,
      type: 'danger',
      title: 'Delete Question',
      message: 'Are you sure you want to delete this question? This action cannot be undone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api.delete(`/api/questions/${questionId}`)
          // Refresh bank questions
          const response = await api.get(`/api/questions/bank/${selectedBank.id}`)
          setQuestions(response.data)
          setSelectedQuestions(prev => prev.filter(q => q.id !== questionId))
          showToast('Question deleted successfully', 'success')
        } catch (err) {
          console.error('Error deleting question:', err)
          showToast(err.response?.data?.detail || 'Failed to delete question', 'error')
        }
      }
    })
  }

  const exportSelectedQuestions = () => {
    if (selectedQuestions.length === 0) {
      showToast('Please select at least one question to export', 'warning')
      return
    }

    // Create a formatted text document
    let content = `${subject?.name || 'Subject'} - ${selectedBank.name} - Question Bank Export\n`
    content += `Generated on: ${new Date().toLocaleString()}\n`
    content += `Total Questions: ${selectedQuestions.length}\n`
    content += `${'='.repeat(80)}\n\n`

    selectedQuestions.forEach((question, index) => {
      content += `Q${index + 1}. ${question.content}\n`
      if (question.part) content += `   Part: ${question.part}\n`
      if (question.unit) content += `   Unit: ${question.unit}\n`
      if (question.topic) content += `   Topic: ${question.topic}\n`
      if (question.difficulty) content += `   Difficulty: ${question.difficulty}\n`
      if (question.marks) content += `   Marks: ${question.marks}\n`
      content += `\n${'-'.repeat(80)}\n\n`
    })

    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(subject?.name || 'Bank').replace(/[^a-z0-9]/gi, '_')}_${selectedBank.name.replace(/[^a-z0-9]/gi, '_')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    showToast(`Exported ${selectedQuestions.length} questions successfully!`, 'success')
  }

  // --- TEACHER QUESTION MANAGEMENT HANDLERS ---
  const handleSaveManualQuestion = async () => {
    if (!manualQuestion.content || !manualQuestion.content.trim()) {
      showToast('Please enter the question content', 'warning')
      return
    }
    if (!selectedBank) {
      showToast('No question bank selected', 'error')
      return
    }

    try {
      setManualSaving(true)
      const payload = {
        bank_id: selectedBank.id,
        content: manualQuestion.content.trim(),
        unit: manualQuestion.unit,
        topic: manualQuestion.topic ? manualQuestion.topic.trim() : null,
        difficulty: manualQuestion.difficulty,
        marks: parseFloat(manualQuestion.marks) || 2,
        source: 'teacher'
      }

      await api.post('/api/questions', payload)
      showToast('Teacher question added successfully!', 'success')
      setShowAddManualModal(false)
      setManualQuestion({ content: '', unit: '1', topic: '', difficulty: 'medium', marks: 2, source: 'teacher' })
      
      // Refresh questions list
      fetchBankQuestions(selectedBank)
    } catch (err) {
      console.error('Error adding teacher question:', err)
      showToast(err.response?.data?.detail || 'Failed to add question', 'error')
    } finally {
      setManualSaving(false)
    }
  }

  const handleParseUploadFile = async () => {
    if (!uploadFile) {
      showToast('Please select a file to upload', 'warning')
      return
    }

    try {
      setParsingFile(true)
      const formData = new FormData()
      formData.append('file', uploadFile)

      const response = await api.post('/api/questions/upload-parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response.data.success && response.data.questions?.length > 0) {
        setParsedQuestions(response.data.questions)
        showToast(`Parsed ${response.data.questions.length} questions successfully!`, 'success')
      } else {
        showToast('No questions could be parsed from the file', 'warning')
      }
    } catch (err) {
      console.error('Error parsing file:', err)
      showToast(err.response?.data?.detail || 'Failed to parse file', 'error')
    } finally {
      setParsingFile(false)
    }
  }

  const handleSaveParsedBatch = async () => {
    if (parsedQuestions.length === 0) {
      showToast('No questions available to save', 'warning')
      return
    }
    if (!selectedBank) {
      showToast('No question bank selected', 'error')
      return
    }

    try {
      setSavingBatch(true)
      const formattedBatch = parsedQuestions.map(q => ({
        bank_id: selectedBank.id,
        content: q.content,
        unit: q.unit || '1',
        topic: q.topic || null,
        difficulty: q.difficulty || 'medium',
        marks: parseFloat(q.marks) || 2,
        source: 'teacher'
      }))

      await api.post('/api/questions/batch', formattedBatch)
      showToast(`Successfully added ${formattedBatch.length} teacher questions to bank!`, 'success')
      setShowUploadModal(false)
      setUploadFile(null)
      setParsedQuestions([])

      // Refresh question bank questions
      fetchBankQuestions(selectedBank)
    } catch (err) {
      console.error('Error saving batch questions:', err)
      showToast(err.response?.data?.detail || 'Failed to save questions batch', 'error')
    } finally {
      setSavingBatch(false)
    }
  }

  if (loading && !selectedBank && banks.length === 0) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h3 style={{ color: '#ef4444' }}>Error</h3>
        <p>{error}</p>
        <Link to="/subjects" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Subjects
        </Link>
      </div>
    )
  }

  // --- BANK LIST VIEW ---
  if (!selectedBank) {
    return (
      <div style={{ padding: '2rem', maxWidth: '100%' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{
                fontSize: '2.25rem',
                fontWeight: '700',
                color: 'var(--secondary-900)',
                margin: 0,
                marginBottom: '0.5rem'
              }}>
                {subject ? `Question Banks for ${subject.name}` : 'All Question Banks'}
              </h1>
              <p style={{ color: 'var(--secondary-500)', margin: 0, fontSize: '1rem' }}>
                Select a question bank to view and manage questions
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {subjectId && (
                <Link to="/subjects" className="btn btn-secondary">
                  <ArrowLeft size={16} /> Back to Subject
                </Link>
              )}
              {!subjectId && (
                <Link to="/subjects" className="btn btn-primary">
                  <BookOpen size={16} /> Manage Subjects
                </Link>
              )}
            </div>
          </div>
        </div>

        {banks.length === 0 ? (
          <div className="card scale-in" style={{ textAlign: 'center', padding: '4rem' }}>
            <Database size={64} style={{ color: '#d1d5db', marginBottom: '1.5rem', display: 'block', margin: '0 auto 1.5rem' }} />
            <h2 style={{ color: '#374151', marginBottom: '0.75rem' }}>No Question Banks Found</h2>
            <p style={{ color: '#6b7280', maxWidth: '500px', margin: '0.5rem auto 2rem' }}>
              {subjectId
                ? "You haven't generated any questions for this subject yet."
                : "No question banks have been created yet. Go to a subject and generate questions to create one."}
            </p>
            {subjectId && (
              <Link to={`/generate-questions/${subjectId}`} className="btn btn-primary">
                Generate Questions Now
              </Link>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.5rem'
          }}>
            {banks.map((bank, index) => (
              <div
                key={bank.id}
                className="card fade-in"
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  animationDelay: `${index * 0.1}s`
                }}
                onClick={() => fetchBankQuestions(bank)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{
                    background: 'var(--gradient-pastel-primary)',
                    color: 'white',
                    padding: '1rem',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-rose)'
                  }}>
                    <Database size={28} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.25rem',
                      color: 'var(--secondary-900)',
                      fontWeight: '700',
                      marginBottom: '0.5rem'
                    }}>
                      {bank.name}
                    </h3>
                    <p style={{
                      margin: 0,
                      color: '#6b7280',
                      fontSize: '0.875rem',
                      lineHeight: '1.5'
                    }}>
                      {bank.description || 'No description'}
                    </p>
                    <div style={{
                      display: 'flex',
                      gap: '1.5rem',
                      marginTop: '1rem',
                      fontSize: '0.875rem'
                    }}>
                      <span style={{
                        color: 'var(--primary-600)',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <Database size={14} />
                        <strong>{bank.total_questions || 0}</strong> Questions
                      </span>
                      <span style={{ color: '#9ca3af' }}>
                        {new Date(bank.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // --- QUESTION LIST VIEW ---
  const uniqueParts = [...new Set(questions.map(q => q.part).filter(Boolean))]
  const uniqueUnits = [...new Set(questions.map(q => q.unit).filter(Boolean))]
  const uniqueMarks = [...new Set(questions.map(q => q.marks?.toString()).filter(Boolean))]

  return (
    <div>
      <div className="card-header">
        <div>
          <h1 className="card-title">
            <button
              onClick={() => setSelectedBank(null)}
              className="btn-icon"
              style={{ marginRight: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', verticalAlign: 'middle' }}
              title="Back to Banks"
            >
              <ArrowLeft size={24} />
            </button>
            {selectedBank.name}
          </h1>
          <p style={{ color: '#666', margin: '0.5rem 0 0 0' }}>
            Subject: {subject?.name || '...'} | Total: {questions.length} | Showing: {filteredQuestions.length}
            {selectedQuestions.length > 0 && ` | Selected: ${selectedQuestions.length}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowAddManualModal(true)}
            className="btn btn-primary"
            style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
          >
            ➕ Add Teacher Question
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-primary"
            style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
          >
            📁 Upload Questions File
          </button>
          <button
            onClick={exportSelectedQuestions}
            disabled={selectedQuestions.length === 0}
            className="btn btn-success"
          >
            <Download size={16} />
            Export Selected ({selectedQuestions.length})
          </button>
          <Link
            to={`/generate-questions/${selectedBank.subject_id}`}
            className="btn btn-primary"
          >
            Generate More
          </Link>
          <button
            onClick={() => setSelectedBank(null)}
            className="btn btn-secondary"
          >
            Back to Banks
          </button>
        </div>
      </div>

      <div className="card">
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Search Questions</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by content, topic, or unit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ 
                  paddingLeft: '3rem',
                  paddingRight: searchTerm ? '3rem' : '1rem',
                  transition: 'all 0.2s ease'
                }}
                title="Search by question content, topic, or unit number"
              />
              <Search
                size={20}
                style={{
                  position: 'absolute',
                  left: '1rem',
                  color: '#666',
                  pointerEvents: 'none'
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    background: 'none',
                    border: 'none',
                    fontSize: '1.2rem',
                    color: '#999',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            {searchTerm && (
              <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
                Found {filteredQuestions.length} of {questions.length} questions
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Part</label>
            <select
              className="form-select"
              value={filters.part}
              onChange={(e) => setFilters(prev => ({ ...prev, part: e.target.value }))}
            >
              <option value="all">All Parts</option>
              {uniqueParts.map(part => (
                <option key={part} value={part}>{part}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Unit</label>
            <select
              className="form-select"
              value={filters.unit}
              onChange={(e) => setFilters(prev => ({ ...prev, unit: e.target.value }))}
            >
              <option value="all">All Units</option>
              {uniqueUnits.map(unit => (
                <option key={unit} value={unit}>Unit {unit}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Difficulty</label>
            <select
              className="form-select"
              value={filters.difficulty}
              onChange={(e) => setFilters(prev => ({ ...prev, difficulty: e.target.value }))}
            >
              <option value="all">All Levels</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Marks</label>
            <select
              className="form-select"
              value={filters.marks}
              onChange={(e) => setFilters(prev => ({ ...prev, marks: e.target.value }))}
            >
              <option value="all">All Marks</option>
              {uniqueMarks.sort((a, b) => parseFloat(a) - parseFloat(b)).map(mark => (
                <option key={mark} value={mark}>{mark} marks</option>
              ))}
            </select>
          </div>

          {(searchTerm || filters.part !== 'all' || filters.unit !== 'all' || filters.difficulty !== 'all' || filters.marks !== 'all') && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => {
                  setSearchTerm('')
                  setFilters({ part: 'all', unit: 'all', difficulty: 'all', marks: 'all' })
                }}
                style={{
                  background: 'var(--secondary-500)',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  width: '100%'
                }}
                onMouseOver={(e) => e.target.style.background = 'var(--secondary-600)'}
                onMouseOut={(e) => e.target.style.background = 'var(--secondary-500)'}
                title="Clear all search and filters"
              >
                ↻ Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner"></div></div>
        ) : filteredQuestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            <Search size={48} style={{ color: '#ccc', marginBottom: '1rem' }} />
            <h3>No questions found</h3>
            {searchTerm && (
              <p>No results for "<strong>{searchTerm}</strong>"</p>
            )}
            <p>Try adjusting your search criteria or filters</p>
            {(searchTerm || filters.part !== 'all' || filters.unit !== 'all' || filters.difficulty !== 'all' || filters.marks !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setFilters({ part: 'all', unit: 'all', difficulty: 'all', marks: 'all' })
                }}
                style={{
                  background: 'var(--primary-500)',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginTop: '1rem'
                }}
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          filteredQuestions.map((question, index) => {
            const isSelected = selectedQuestions.some(q => q.id === question.id)
            const isExpanded = expandedQuestions[question.id]

            return (
              <div
                key={question.id}
                className="list-item fade-in"
                style={{
                  padding: '1.5rem',
                  transition: 'all 0.2s ease',
                  background: isSelected ? 'var(--rose-50)' : 'white',
                  border: isSelected ? '2px solid var(--primary-400)' : '1px solid var(--secondary-200)',
                  borderRadius: '12px',
                  marginBottom: '1rem',
                  animationDelay: `${index * 0.05}s`
                }}
              >
                <div style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={isSelected}
                    onChange={() => toggleQuestionSelection(question)}
                    style={{
                      marginTop: '0.25rem',
                      cursor: 'pointer',
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--primary-500)'
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      marginBottom: isExpanded ? '1rem' : '0',
                      wordBreak: 'break-word',
                      lineHeight: '1.6',
                      whiteSpace: 'normal',
                      display: 'block',
                      width: '100%'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <strong style={{ color: 'var(--primary-600)' }}>Q{index + 1}:</strong>
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: question.source === 'teacher' ? '#f3e8ff' : '#e0f2fe',
                          color: question.source === 'teacher' ? '#7e22ce' : '#0369a1',
                          border: question.source === 'teacher' ? '1px solid #d8b4fe' : '1px solid #7dd3fc'
                        }}>
                          {question.source === 'teacher' ? '👩‍🏫 Teacher Question' : '🤖 AI Generated'}
                        </span>
                      </div>
                      <span style={{ color: 'var(--secondary-900)', fontSize: '1rem' }}>
                        {question.content}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="slide-up" style={{
                        display: 'flex',
                        gap: '1rem',
                        fontSize: '0.875rem',
                        color: '#666',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        paddingTop: '0.75rem',
                        borderTop: '2px solid #e0f2fe'
                      }}>
                        {question.part && (
                          <span style={{
                            padding: '0.375rem 0.75rem',
                            background: 'var(--gradient-pastel-button)',
                            color: 'white',
                            borderRadius: '6px',
                            fontWeight: '600',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            📝 {question.part}
                          </span>
                        )}
                        {question.unit && (
                          <span style={{
                            padding: '0.375rem 0.75rem',
                            backgroundColor: 'var(--rose-100)',
                            color: 'var(--primary-800)',
                            borderRadius: '6px',
                            fontWeight: '600'
                          }}>
                            📚 Unit {question.unit}
                          </span>
                        )}
                        {question.topic && (
                          <span style={{
                            padding: '0.375rem 0.75rem',
                            backgroundColor: '#f3e8ff',
                            color: '#6b21a8',
                            borderRadius: '6px',
                            fontWeight: '500'
                          }}>
                            📖 {question.topic}
                          </span>
                        )}
                        {question.difficulty && (
                          <span style={{
                            padding: '0.375rem 0.75rem',
                            borderRadius: '6px',
                            fontWeight: '600',
                            background: question.difficulty.toLowerCase() === 'easy'
                              ? 'linear-gradient(135deg, #10b981, #059669)'
                              : question.difficulty.toLowerCase() === 'medium'
                                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                : 'linear-gradient(135deg, #ef4444, #dc2626)',
                            color: 'white',
                            textTransform: 'uppercase',
                            fontSize: '0.75rem',
                            letterSpacing: '0.05em'
                          }}>
                            ⭐ {question.difficulty}
                          </span>
                        )}
                        {question.marks && (
                          <span style={{
                            padding: '0.375rem 0.75rem',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '6px',
                            fontWeight: '600'
                          }}>
                            🎯 {question.marks} marks
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      onClick={() => toggleQuestionExpand(question.id)}
                      className="btn btn-outline"
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: '2px solid #06b6d4',
                        color: '#06b6d4',
                        background: 'white'
                      }}
                      title={isExpanded ? 'Show less' : 'Show more'}
                    >
                      {isExpanded ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={() => deleteQuestion(question.id)}
                      className="btn btn-danger"
                      style={{ padding: '0.5rem 0.75rem' }}
                      title="Delete question"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* --- OPTION A: MANUAL TEACHER QUESTION MODAL --- */}
      {showAddManualModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem'
        }} onClick={() => setShowAddManualModal(false)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '2rem',
            maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1e293b' }}>👩‍🏫 Add Teacher Question (Manual)</h2>
              <button onClick={() => setShowAddManualModal(false)} className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="form-label" style={{ fontWeight: '600' }}>Question Content *</label>
                <textarea
                  className="form-input"
                  rows="4"
                  placeholder="Enter the full question text here..."
                  value={manualQuestion.content}
                  onChange={(e) => setManualQuestion({ ...manualQuestion, content: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: '600' }}>Unit Number *</label>
                  <select
                    className="form-select"
                    value={manualQuestion.unit}
                    onChange={(e) => setManualQuestion({ ...manualQuestion, unit: e.target.value })}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(u => (
                      <option key={u} value={u.toString()}>Unit {u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: '600' }}>Topic (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Fourier Analysis"
                    value={manualQuestion.topic}
                    onChange={(e) => setManualQuestion({ ...manualQuestion, topic: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: '600' }}>Difficulty *</label>
                  <select
                    className="form-select"
                    value={manualQuestion.difficulty}
                    onChange={(e) => setManualQuestion({ ...manualQuestion, difficulty: e.target.value })}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: '600' }}>Marks *</label>
                  <select
                    className="form-select"
                    value={manualQuestion.marks}
                    onChange={(e) => setManualQuestion({ ...manualQuestion, marks: parseFloat(e.target.value) })}
                  >
                    <option value={2}>2 Marks</option>
                    <option value={5}>5 Marks</option>
                    <option value={10}>10 Marks</option>
                    <option value={13}>13 Marks</option>
                    <option value={16}>16 Marks</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setShowAddManualModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSaveManualQuestion} disabled={manualSaving} className="btn btn-primary" style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}>
                {manualSaving ? 'Saving Question...' : 'Save Question to Bank'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- OPTION B: UPLOAD QUESTIONS FILE & PARSE PREVIEW MODAL --- */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem'
        }} onClick={() => setShowUploadModal(false)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '2rem',
            maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1e293b' }}>📁 Upload Questions File</h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Upload JSON, CSV, TXT, DOCX, or PDF files. Parsed questions can be reviewed before saving.
                </p>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc'
              }}>
                <input
                  type="file"
                  accept=".json,.csv,.txt,.docx,.pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFile(e.target.files[0])
                      setParsedQuestions([])
                    }
                  }}
                  style={{ display: 'none' }}
                  id="file-upload-input"
                />
                <label htmlFor="file-upload-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '2rem' }}>📄</span>
                  <span style={{ fontWeight: '600', color: '#334155' }}>
                    {uploadFile ? uploadFile.name : 'Click to choose or drag a file here'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Supported formats: .json, .csv, .txt, .docx, .pdf
                  </span>
                </label>
              </div>

              {uploadFile && parsedQuestions.length === 0 && (
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={handleParseUploadFile}
                    disabled={parsingFile}
                    className="btn btn-primary"
                    style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', padding: '0.75rem 2rem' }}
                  >
                    {parsingFile ? (
                      <>
                        <div className="spinner" style={{ width: '16px', height: '16px', display: 'inline-block' }}></div>
                        &nbsp; Parsing Questions...
                      </>
                    ) : '🔍 Parse & Preview Questions'}
                  </button>
                </div>
              )}

              {/* Parsed Questions Review & Edit Table */}
              {parsedQuestions.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>
                      Preview Parsed Questions ({parsedQuestions.length})
                    </h3>
                    <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: '600' }}>
                      ✓ Check or edit items before saving
                    </span>
                  </div>

                  <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '0.75rem', width: '50px' }}>#</th>
                          <th style={{ padding: '0.75rem' }}>Question Content</th>
                          <th style={{ padding: '0.75rem', width: '80px' }}>Unit</th>
                          <th style={{ padding: '0.75rem', width: '100px' }}>Difficulty</th>
                          <th style={{ padding: '0.75rem', width: '80px' }}>Marks</th>
                          <th style={{ padding: '0.75rem', width: '60px' }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedQuestions.map((q, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem', fontWeight: '600', color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <textarea
                                value={q.content}
                                onChange={(e) => {
                                  const updated = [...parsedQuestions]
                                  updated[idx].content = e.target.value
                                  setParsedQuestions(updated)
                                }}
                                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.4rem', fontSize: '0.85rem' }}
                                rows="2"
                              />
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <input
                                type="text"
                                value={q.unit || '1'}
                                onChange={(e) => {
                                  const updated = [...parsedQuestions]
                                  updated[idx].unit = e.target.value
                                  setParsedQuestions(updated)
                                }}
                                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.4rem' }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <select
                                value={q.difficulty || 'medium'}
                                onChange={(e) => {
                                  const updated = [...parsedQuestions]
                                  updated[idx].difficulty = e.target.value
                                  setParsedQuestions(updated)
                                }}
                                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.4rem' }}
                              >
                                <option value="easy">easy</option>
                                <option value="medium">medium</option>
                                <option value="hard">hard</option>
                              </select>
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <input
                                type="number"
                                value={q.marks || 2}
                                onChange={(e) => {
                                  const updated = [...parsedQuestions]
                                  updated[idx].marks = e.target.value
                                  setParsedQuestions(updated)
                                }}
                                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.4rem' }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  setParsedQuestions(prev => prev.filter((_, i) => i !== idx))
                                }}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                                title="Remove item"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setShowUploadModal(false)} className="btn btn-secondary">Cancel</button>
              {parsedQuestions.length > 0 && (
                <button
                  onClick={handleSaveParsedBatch}
                  disabled={savingBatch}
                  className="btn btn-primary"
                  style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                >
                  {savingBatch ? 'Saving Questions...' : `Confirm & Save ${parsedQuestions.length} Questions`}
                </button>
              )}
            </div>
          </div>
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

export default QuestionBank