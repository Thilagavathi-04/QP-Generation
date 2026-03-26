import React, { useState, useEffect } from 'react'
import { FileOutput, Download, Calendar, Clock, X, Edit2, RefreshCw, Save } from 'lucide-react'
import api from '../utils/api'
import { showToast } from '../components/Toast'
import Modal from '../components/Modal'

const QuestionPaperGeneration = () => {
  const [subjects, setSubjects] = useState([])
  const [blueprints, setBlueprints] = useState([])
  const [units, setUnits] = useState([])
  const [questionBanks, setQuestionBanks] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [generatedPapers, setGeneratedPapers] = useState([])
  const [modalState, setModalState] = useState({ isOpen: false, type: '', data: null })
  const [formData, setFormData] = useState({
    subjectId: '',
    questionBankId: '',
    blueprintId: '',
    unitRange: { from: '', to: '' },
    examDate: '',
    examDuration: '3',
    outputFormat: 'pdf',
    title: '',
    examType: 'Regular',
    numberOfSets: 1
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (formData.subjectId) {
      fetchUnits(formData.subjectId)
      setFormData(prev => ({ ...prev, questionBankId: '' }))
    } else {
      setFormData(prev => ({ ...prev, questionBankId: '' }))
    }
  }, [formData.subjectId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [subjectsRes, blueprintsRes] = await Promise.all([
        api.get('/api/subjects'),
        api.get('/api/blueprints')
      ])
      setSubjects(subjectsRes.data)
      setBlueprints(blueprintsRes.data)

      const questionBanksRes = await api.get('/api/question-banks')
      setQuestionBanks(questionBanksRes.data)
    } catch (err) {
      console.error('Error fetching data:', err)
      showToast(err.response?.data?.detail || 'Failed to fetch data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchUnits = async (subjectId) => {
    try {
      const response = await api.get(`/api/subjects/${subjectId}/units`)
      setUnits(response.data.units || response.data)
      if (response.data.units?.length > 0 || response.data.length > 0) {
        const unitsArray = response.data.units || response.data
        setFormData(prev => ({
          ...prev,
          unitRange: {
            from: unitsArray[0].unit_number.toString(),
            to: unitsArray[unitsArray.length - 1].unit_number.toString()
          }
        }))
      }
    } catch (err) {
      console.error('Error fetching units:', err)
    }
  }

  const editQuestion = (setIndex, partIndex, questionIndex) => {
    const question = generatedPapers[setIndex].parts[partIndex].questions[questionIndex]

    setModalState({
      isOpen: true,
      type: 'confirm',
      title: 'Edit Question',
      message: 'Enter the new question content:',
      showInput: true,
      inputType: 'textarea',
      defaultValue: question.content,
      confirmText: 'Save Changes',
      onConfirm: (newContent) => {
        if (!newContent || !newContent.trim()) {
          showToast('Question content cannot be empty', 'warning')
          return
        }

        setGeneratedPapers(prev => {
          const updated = [...prev]
          updated[setIndex].parts[partIndex].questions[questionIndex].content = newContent.trim()
          return updated
        })
        showToast('Question updated successfully', 'success')
      }
    })
  }

  const regenerateQuestion = async (setIndex, partIndex, questionIndex) => {
    const part = generatedPapers[setIndex].parts[partIndex]

    try {
      showToast('Regenerating question...', 'info')

      const response = await api.post(`/api/subjects/${formData.subjectId}/generate-questions`, {
        from_unit: formData.unitRange.from,
        to_unit: formData.unitRange.to,
        count: 1,
        marks: part.marks_per_question,
        difficulty: part.difficulty,
        part_name: part.part_name
      })

      if (response.data.success && response.data.questions.length > 0) {
        const newQuestion = {
          id: `regenerated-${Date.now()}-${Math.random()}`,
          content: response.data.questions[0].content,
          unit: response.data.questions[0].unit,
          topic: response.data.questions[0].topic,
          difficulty: response.data.questions[0].difficulty || part.difficulty,
          marks: response.data.questions[0].marks || part.marks_per_question
        }

        setGeneratedPapers(prev => {
          const updated = [...prev]
          updated[setIndex].parts[partIndex].questions[questionIndex] = newQuestion
          return updated
        })

        showToast('Question regenerated successfully!', 'success')
      }
    } catch (error) {
      console.error('Error regenerating question:', error)
      showToast('Failed to regenerate question', 'error')
    }
  }

  const downloadPaper = (paper) => {
    const selectedSubject = subjects.find(s => s.id === parseInt(formData.subjectId))

    let content = `${formData.title}\n`
    content += `${formData.examType}\n`
    content += `Subject: ${selectedSubject?.name || 'N/A'}\n`
    if (formData.examDate) content += `Date: ${new Date(formData.examDate).toLocaleDateString()}\n`
    content += `Duration: ${formData.examDuration} hours\n`
    content += `${'='.repeat(80)}\n\n`
    content += `${paper.setName}\n`
    content += `${'='.repeat(80)}\n\n`

    paper.parts.forEach((part) => {
      content += `\n${part.part_name}`
      if (part.instructions) content += ` - ${part.instructions}`
      content += `\n${'-'.repeat(60)}\n`

      part.questions.forEach((q, qIndex) => {
        content += `\nQ${qIndex + 1}. ${q.content}`
        if (q.marks) content += ` [${q.marks} marks]`
        content += `\n`
      })

      content += `\n`
    })

    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${formData.title.replace(/[^a-z0-9]/gi, '_')}_${paper.setName.replace(/\s+/g, '_')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    showToast(`${paper.setName} downloaded successfully!`, 'success')
  }

  const downloadAllPapers = () => {
    const selectedSubject = subjects.find(s => s.id === parseInt(formData.subjectId))

    let content = `${formData.title}\n`
    content += `${formData.examType}\n`
    content += `Subject: ${selectedSubject?.name || 'N/A'}\n`
    if (formData.examDate) content += `Date: ${new Date(formData.examDate).toLocaleDateString()}\n`
    content += `Duration: ${formData.examDuration} hours\n`
    content += `Total Sets: ${generatedPapers.length}\n`
    content += `${'='.repeat(80)}\n\n`

    generatedPapers.forEach((paper, paperIndex) => {
      content += `\n${'='.repeat(80)}\n`
      content += `${paper.setName}\n`
      content += `${'='.repeat(80)}\n\n`

      paper.parts.forEach((part) => {
        content += `\n${part.part_name}`
        if (part.instructions) content += ` - ${part.instructions}`
        content += `\n${'-'.repeat(60)}\n`

        part.questions.forEach((q, qIndex) => {
          content += `\nQ${qIndex + 1}. ${q.content}`
          if (q.marks) content += ` [${q.marks} marks]`
          content += `\n`
        })

        content += `\n`
      })

      if (paperIndex < generatedPapers.length - 1) {
        content += `\n\n`
      }
    })

    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${formData.title.replace(/[^a-z0-9]/gi, '_')}_AllSets.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    showToast(`All ${generatedPapers.length} sets downloaded successfully!`, 'success')
  }

  // ✅ Save papers to backend as PDF/DOCX
  const saveAllPapers = async () => {
    try {
      setSaving(true)
      const selectedSubject = subjects.find(s => s.id === parseInt(formData.subjectId))
      const selectedBlueprint = blueprints.find(b => b.id === parseInt(formData.blueprintId))

      const totalMarks = selectedBlueprint?.parts?.reduce((sum, part) =>
        sum + (part.num_questions * part.marks_per_question), 0
      ) || selectedBlueprint?.total_marks || 100

      console.log('💾 Saving papers as', formData.outputFormat.toUpperCase())
      console.log('Total papers to save:', generatedPapers.length)

      for (const paper of generatedPapers) {
        // Prepare paper data for backend
        const paperData = {
          title: `${formData.title} - ${paper.setName}`,
          subject_id: parseInt(formData.subjectId),
          blueprint_id: formData.blueprintId ? parseInt(formData.blueprintId) : null,
          exam_type: formData.examType || 'Regular',
          exam_date: formData.examDate || null,
          exam_duration: formData.examDuration || '3',
          total_marks: totalMarks,
          file_format: formData.outputFormat, // 'pdf' or 'docx'
          paper_data: {
            parts: paper.parts.map(part => ({
              part_name: part.part_name,
              instructions: part.instructions || 'Answer all questions',
              marks_per_question: part.marks_per_question,
              difficulty: part.difficulty,
              questions: part.questions.map(q => ({
                content: q.content,
                marks: q.marks,
                topic: q.topic,
                unit: q.unit,
                difficulty: q.difficulty
              }))
            }))
          }
        }

        console.log('📤 Sending paper:', paperData.title)

        const response = await api.post('/api/question-papers/generate-from-data', paperData, {
          headers: {
            'Content-Type': 'application/json'
          }
        })

        console.log('✅ Paper saved:', response.data)
      }

      showToast(`Successfully saved ${generatedPapers.length} question paper(s) as ${formData.outputFormat.toUpperCase()}!`, 'success')
      setShowPreview(false)

      setGeneratedPapers([])
      setFormData({
        subjectId: '',
        questionBankId: '',
        blueprintId: '',
        unitRange: { from: '', to: '' },
        examDate: '',
        examDuration: '3',
        outputFormat: 'pdf',
        title: '',
        examType: 'Regular',
        numberOfSets: 1
      })

    } catch (error) {
      console.error('❌ Error saving papers:', error)
      console.error('Error response:', error.response?.data)

      let errorMessage = 'Failed to save papers'
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail.map(e =>
            `Field: ${e.loc.join('.')}\nError: ${e.msg}\nType: ${e.type}`
          ).join('\n\n')
        } else {
          errorMessage = error.response.data.detail
        }
      }

      showToast(errorMessage, 'error', 8010)
    } finally {
      setSaving(false)
    }
  }

  const handleGeneratePaper = async () => {
    if (!formData.subjectId || !formData.blueprintId || !formData.questionBankId) {
      showToast('Please select subject, question bank, and blueprint', 'warning')
      return
    }

    if (!formData.title.trim()) {
      showToast('Please enter a title for the question paper', 'warning')
      return
    }

    const numSets = parseInt(formData.numberOfSets)
    if (numSets < 1 || numSets > 10) {
      showToast('Number of sets must be between 1 and 10', 'warning')
      return
    }

    try {
      setGenerating(true)

      console.log('📋 Fetching blueprint:', formData.blueprintId)
      const blueprintRes = await api.get(`/api/blueprints/${formData.blueprintId}`)
      const blueprint = blueprintRes.data
      console.log('✅ Blueprint loaded:', blueprint.name, '- Parts:', blueprint.parts?.length)

      console.log('🔍 Fetching questions from question bank:', formData.questionBankId)
      const questionsRes = await api.get(`/api/questions/by-question-bank/${formData.questionBankId}`)
      const allQuestions = questionsRes.data
      console.log('✅ Found', allQuestions.length, 'questions')

      if (!allQuestions || allQuestions.length === 0) {
        showToast('No questions found in the selected question bank. Please add questions first.', 'error')
        return
      }

      const generatedSets = []

      for (let setIndex = 0; setIndex < numSets; setIndex++) {
        const setName = String.fromCharCode(65 + setIndex)
        const setParts = []

        for (const part of blueprint.parts) {
          let filteredQuestions = allQuestions.filter(q => {
            // Match difficulty: if part specifies difficulty, match it; if question has no difficulty, include it
            const matchesDifficulty = !part.difficulty || !q.difficulty || q.difficulty?.toLowerCase() === part.difficulty.toLowerCase()
            // Match marks: if part specifies marks, match it; if question has no marks, include it
            const matchesMarks = !part.marks_per_question || !q.marks || parseFloat(q.marks) === parseFloat(part.marks_per_question)
            return matchesDifficulty && matchesMarks
          })

          console.log(`📋 Set ${setName}, ${part.part_name}: Found ${filteredQuestions.length} matching questions`)

          filteredQuestions = filteredQuestions.sort(() => Math.random() - 0.5)
          const selectedQuestions = filteredQuestions.slice(0, part.num_questions)

          if (selectedQuestions.length < part.num_questions) {
            console.warn(`⚠️ Not enough questions for ${part.part_name}. Need ${part.num_questions}, found ${selectedQuestions.length}`)
          }

          setParts.push({
            part_name: part.part_name,
            instructions: part.instructions || 'Answer all questions',
            difficulty: part.difficulty,
            marks_per_question: part.marks_per_question,
            questions: selectedQuestions.map((q, i) => ({
              id: `set${setIndex}-${part.part_name}-${i}-${q.id}`,
              content: q.content,
              unit: q.unit,
              topic: q.topic,
              difficulty: q.difficulty,
              marks: q.marks
            }))
          })
        }

        generatedSets.push({
          setName: `Set ${setName}`,
          parts: setParts
        })
      }

      setGeneratedPapers(generatedSets)
      setShowPreview(true)
      showToast(`Successfully generated ${numSets} question paper set(s)!`, 'success')

    } catch (err) {
      console.error('❌ Error generating paper:', err)

      let errorMessage = 'Failed to generate question paper'
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map(e => `${e.loc.join('.')}: ${e.msg}`).join('\n')
        } else {
          errorMessage = err.response.data.detail
        }
      } else if (err.message) {
        errorMessage = err.message
      }

      showToast(errorMessage, 'error', 5000)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  return (
    <div>
      {showPreview && (
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
            zIndex: 1000,
            padding: '2rem',
            overflow: 'auto'
          }}
          onClick={() => setShowPreview(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '1200px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto'
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
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
                  {formData.title}
                </h2>
                <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.875rem' }}>
                  {formData.examType} | {generatedPapers.length} Set(s)
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={saveAllPapers}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? (
                    <>
                      <div className="spinner" style={{ width: '16px', height: '16px', display: 'inline-block' }}></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save All
                    </>
                  )}
                </button>
                <button
                  onClick={downloadAllPapers}
                  className="btn btn-success"
                >
                  <Download size={16} />
                  Download All
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="btn btn-secondary"
                >
                  <X size={16} />
                  Close
                </button>
              </div>
            </div>

            {generatedPapers.map((paper, setIndex) => (
              <div
                key={setIndex}
                style={{
                  marginBottom: '2rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  backgroundColor: '#f9fafb'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem',
                  borderBottom: '2px solid var(--primary-400)',
                  paddingBottom: '0.75rem'
                }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: '#1f2937'
                  }}>
                    {paper.setName}
                  </h3>
                  <button
                    onClick={() => downloadPaper(paper)}
                    className="btn btn-outline"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>

                {paper.parts.map((part, partIndex) => (
                  <div key={partIndex} style={{ marginBottom: '2rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      marginBottom: '1rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid #d1d5db'
                    }}>
                      <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                        {part.part_name}
                      </h4>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: part.difficulty === 'easy'
                          ? '#d4edda'
                          : part.difficulty === 'medium'
                            ? '#fff3cd'
                            : '#f8d7da',
                        color: part.difficulty === 'easy'
                          ? '#155724'
                          : part.difficulty === 'medium'
                            ? '#856404'
                            : '#721c24'
                      }}>
                        {part.difficulty?.charAt(0).toUpperCase() + part.difficulty?.slice(1)}
                      </span>
                      {part.instructions && (
                        <span style={{ fontSize: '0.875rem', color: '#666', fontStyle: 'italic' }}>
                          {part.instructions}
                        </span>
                      )}
                    </div>

                    {part.questions.length === 0 ? (
                      <div style={{
                        padding: '1rem',
                        backgroundColor: '#fef3c7',
                        borderRadius: '6px',
                        border: '1px solid #fbbf24',
                        color: '#92400e',
                        fontSize: '0.875rem'
                      }}>
                        ⚠️ Not enough questions available for this part
                      </div>
                    ) : (
                      part.questions.map((question, qIndex) => (
                        <div
                          key={qIndex}
                          style={{
                            padding: '1rem',
                            backgroundColor: 'white',
                            borderRadius: '6px',
                            marginBottom: '0.75rem',
                            border: '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ marginBottom: '0.5rem' }}>
                                <strong style={{ color: '#1f2937' }}>Q{qIndex + 1}.</strong>{' '}
                                {question.content}
                              </div>
                              <div style={{
                                fontSize: '0.875rem',
                                color: '#666',
                                display: 'flex',
                                gap: '1rem',
                                flexWrap: 'wrap'
                              }}>
                                {question.marks && <span>🎯 {question.marks} marks</span>}
                                {question.topic && <span>📚 {question.topic}</span>}
                                {question.unit && <span>📖 Unit {question.unit}</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                              <button
                                onClick={() => editQuestion(setIndex, partIndex, qIndex)}
                                className="btn btn-outline"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                title="Edit Question"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => regenerateQuestion(setIndex, partIndex, qIndex)}
                                className="btn btn-outline"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                title="Regenerate Question"
                              >
                                <RefreshCw size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        background: 'var(--gradient-banner)',
        padding: '2rem',
        borderRadius: '16px',
        marginBottom: '2rem',
        boxShadow: 'var(--shadow-rose)',
        color: 'white'
      }} className="fade-in">
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '700',
          marginBottom: '0.5rem',
          color: 'white',
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>Generate Question Paper</h1>
        <p style={{ opacity: 0.95, fontSize: '0.95rem' }}>
          Create professional exam papers with custom blueprints
        </p>
      </div>

      <div className="card fade-in" style={{
        animationDelay: '0.1s',
        borderLeft: '4px solid var(--primary-400)'
      }}>
        <h3 style={{ color: 'var(--primary-700)', marginBottom: '1.5rem' }}>Question Paper Details</h3>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Paper Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Mid-Term Examination 2026"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Exam Type</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Regular, Mid-Term, End-Term"
              value={formData.examType}
              onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Number of Sets *</label>
            <input
              type="number"
              className="form-input"
              placeholder="e.g., 1, 2, 3"
              min="1"
              max="10"
              value={formData.numberOfSets}
              onChange={(e) => setFormData({ ...formData, numberOfSets: parseInt(e.target.value) || 1 })}
            />
            {/* <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem', marginBottom: 0 }}>
              Generate multiple sets (Set A, Set B, etc.)
            </p> */}
          </div>
        </div>
      </div>

      <div className="card fade-in" style={{
        animationDelay: '0.2s',
        borderLeft: '4px solid var(--primary-400)'
      }}>
        <h3 style={{ color: 'var(--primary-700)', marginBottom: '1.5rem' }}>Subject and Blueprint Selection</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Subject *</label>
            <select
              className="form-select"
              value={formData.subjectId}
              onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
            >
              <option value="">Select Subject</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.subject_id} - {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Question Bank *</label>
            <select
              className="form-select"
              value={formData.questionBankId}
              onChange={(e) => setFormData({ ...formData, questionBankId: e.target.value })}
              disabled={!formData.subjectId}
            >
              <option value="">
                {!formData.subjectId ? 'Select a subject first' : 'Select Question Bank'}
              </option>
              {questionBanks
                .filter(bank => !formData.subjectId || bank.subject_id === parseInt(formData.subjectId))
                .map(bank => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name} ({bank.total_questions || 0} questions)
                  </option>
                ))
              }
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Blueprint *</label>
            <select
              className="form-select"
              value={formData.blueprintId}
              onChange={(e) => setFormData({ ...formData, blueprintId: e.target.value })}
            >
              <option value="">Select Blueprint</option>
              {blueprints.map(blueprint => (
                <option key={blueprint.id} value={blueprint.id}>
                  {blueprint.name} ({blueprint.total_questions} Q, {blueprint.total_marks} M)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Exam Details</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--primary-600)',
                color: 'white',
                padding: '4px',
                borderRadius: '6px',
                marginRight: '0.5rem'
              }}>
                <Calendar size={14} />
              </span>
              Exam Date
            </label>
            <input
              type="date"
              className="form-input"
              style={{ colorScheme: 'light' }}
              value={formData.examDate}
              onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--primary-600)',
                color: 'white',
                padding: '4px',
                borderRadius: '6px',
                marginRight: '0.5rem'
              }}>
                <Clock size={14} />
              </span>
              Duration (hours)
            </label>
            <input
              type="number"
              className="form-input"
              min="1"
              max="5"
              value={formData.examDuration}
              onChange={(e) => setFormData({ ...formData, examDuration: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Output Format</label>
            <select
              className="form-select"
              value={formData.outputFormat}
              onChange={(e) => setFormData({ ...formData, outputFormat: e.target.value })}
            >
              <option value="pdf">PDF</option>
              <option value="docx">Word Document</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ textAlign: 'center' }}>
        <button
          onClick={handleGeneratePaper}
          disabled={generating || !formData.subjectId || !formData.blueprintId || !formData.questionBankId || !formData.title}
          className="btn btn-primary"
          style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}
        >
          {generating ? (
            <>
              <div className="spinner" style={{ width: '20px', height: '20px', display: 'inline-block' }}></div>
              Generating...
            </>
          ) : (
            <>
              <FileOutput size={20} />
              Generate {formData.numberOfSets} Question Paper{formData.numberOfSets > 1 ? 's' : ''}
            </>
          )}
        </button>
        <p style={{ color: '#666', marginTop: '1rem', fontSize: '0.875rem' }}>
          {formData.numberOfSets > 1
            ? `${formData.numberOfSets} different sets will be generated (Set A, Set B, ${formData.numberOfSets > 2 ? 'Set C, ' : ''}etc.)`
            : 'The question paper will be generated using questions from the selected question bank based on the blueprint structure'
          }
        </p>
      </div>

      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText || 'Confirm'}
        type={modalState.type}
        showInput={modalState.showInput}
        inputType={modalState.inputType}
        inputPlaceholder={modalState.inputPlaceholder}
        defaultValue={modalState.defaultValue}
      />
    </div>
  )
}

export default QuestionPaperGeneration