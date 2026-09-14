import React, { useState, useEffect } from 'react'
import { FileOutput, Download, Calendar, Clock, X, Edit2, RefreshCw, Save, Upload } from 'lucide-react'
import api from '../utils/api'
import { showToast } from '../utils/toast'
import Modal from '../components/Modal'

const QuestionPaperGeneration = () => {
  const [subjects, setSubjects] = useState([])
  const [blueprints, setBlueprints] = useState([])
  const [questionBanks, setQuestionBanks] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewView, setPreviewView] = useState('pdf') // 'pdf' or 'cards'
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null)
  const [generatedPapers, setGeneratedPapers] = useState([])
  const [questionImages, setQuestionImages] = useState({}) // Map of question_id -> image_url
  const [loadingImages, setLoadingImages] = useState(false)
  const [uploadingImageKey, setUploadingImageKey] = useState(null)
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
    numberOfSets: 1,
    needImage: 'no',
    imageSources: ['web', 'book', 'user']
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

  useEffect(() => {
    if (showPreview && generatedPapers.length > 0) {
      fetchQuestionImages()
    }
  }, [showPreview, generatedPapers])

  const fetchQuestionImages = async () => {
    try {
      setLoadingImages(true)
      const images = {}
      
      for (const paper of generatedPapers) {
        for (const part of paper.parts) {
          for (const question of part.questions) {
            if (question.id) {
              try {
                const response = await api.get(`/api/questions/${question.id}/image`, {
                  responseType: 'blob'
                })
                const imageUrl = URL.createObjectURL(response.data)
                images[question.id] = imageUrl
              } catch (error) {
                // No image for this question, skip
                console.log(`No image for question ${question.id}`)
              }
            }
          }
        }
      }
      
      setQuestionImages(images)
    } catch (error) {
      console.error('Error fetching question images:', error)
    } finally {
      setLoadingImages(false)
    }
  }

  const handleUploadImageForQuestion = async (setIndex, partIndex, questionIndex, file) => {
    const uploadKey = `${setIndex}-${partIndex}-${questionIndex}`
    try {
      setUploadingImageKey(uploadKey)
      const question = generatedPapers[setIndex].parts[partIndex].questions[questionIndex]

      const formDataToSend = new FormData()
      formDataToSend.append('file', file)
      formDataToSend.append('keywords', question.content.substring(0, 100))
      formDataToSend.append('description', 'User uploaded image in preview')

      const response = await api.post('/api/question-images/upload', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (response.data && response.data.image_id) {
        // Update the question's image_id in local state
        setGeneratedPapers(prev => {
          const updated = [...prev]
          updated[setIndex].parts[partIndex].questions[questionIndex].image_id = response.data.image_id
          return updated
        })

        // Create a local object URL for immediate display
        const localUrl = URL.createObjectURL(file)
        const compositeId = question.id
        setQuestionImages(prev => ({ ...prev, [compositeId]: localUrl }))

        showToast('Image uploaded successfully!', 'success')
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      showToast('Failed to upload image', 'error')
    } finally {
      setUploadingImageKey(null)
    }
  }

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

  const loadCourseOutcomeAsset = async (subject) => {
    if (!subject?.course_outcome_file) return null

    const filename = subject.course_outcome_file.split('/').pop() || 'course_outcome'
    const ext = filename.split('.').pop()?.toLowerCase()
    const isImage = ['png', 'jpg', 'jpeg'].includes(ext)

    try {
      const response = await api.get(`/api/subjects/${subject.id}/course-outcome-file`, {
        responseType: 'blob'
      })

      if (!isImage) {
        return { type: 'file', filename }
      }

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(response.data)
      })

      return { type: 'image', filename, dataUrl, ext }
    } catch (error) {
      console.warn('Failed to load course outcome file:', error)
      return { type: 'file', filename }
    }
  }

  const generatePDF = async (papers, filename) => {
    const [{ jsPDF }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ])

    const doc = new jsPDF()
    const selectedSubject = subjects.find(s => s.id === parseInt(formData.subjectId))
    const examDate = formData.examDate ? new Date(formData.examDate).toLocaleDateString() : new Date().toLocaleDateString()
    const courseOutcomeAsset = await loadCourseOutcomeAsset(selectedSubject)

    papers.forEach((paper, paperIndex) => {
      if (paperIndex > 0) doc.addPage()

      // 🏛️ COLLEGE HEADER
      doc.setDrawColor(0)
      doc.setLineWidth(0.5)
      doc.rect(10, 10, 190, 36) // Header box - Made taller for more text

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('SRI SHAKTHI INSTITUTE OF ENGINEERING AND TECHNOLOGY', 105, 17, { align: 'center' })
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('(An Autonomous Institution)', 105, 23, { align: 'center' })
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.text('Affiliated to Anna University, Chennai', 105, 28, { align: 'center' })
      doc.text('Re-Accredited by NAAC with "A", Recognized by UGC with Section 2(f) and 12(B)', 105, 32, { align: 'center' })
      doc.text('NBA Accredited UG Programmes : Agri, BME, BT, CSE, ECE, EEE, MECH, FT and IT', 105, 36, { align: 'center' })
      doc.text('Coimbatore - 641 062, L & T By Pass, Tamil Nadu, India', 105, 41, { align: 'center' })

      // 📝 REGISTRATION & DATE
      doc.setFontSize(10)
      doc.text(`Date: ${examDate}`, 15, 54)
      
      doc.text('Reg No: ', 110, 54)
      let boxX = 125
      for (let i = 0; i < 12; i++) {
        doc.rect(boxX, 50, 5.5, 5.5)
        boxX += 5.5
      }

      // 🎓 EXAM DETAILS
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(formData.examType.toUpperCase() + ' EXAMINATION', 105, 68, { align: 'center' })
      doc.text(`Subject: ${selectedSubject?.name || 'N/A'}`, 105, 75, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Time: ${formData.examDuration} hours`, 15, 84)
      doc.text(`Maximum: ${formData.totalMarks || 100} Marks`, 195, 84, { align: 'right' })

      doc.line(10, 88, 200, 88)

      // 💬 PART INSTRUCTIONS
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Answer all the Questions', 105, 95, { align: 'center' })
      doc.line(10, 100, 200, 100)

      let yPos = 110
      let qNum = 1

      paper.parts.forEach((part) => {
        // Part Title
        if (yPos > 260) { doc.addPage(); yPos = 20 }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text(part.part_name, 15, yPos)
        
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        if (part.instructions) doc.text(`(${part.instructions})`, 15, yPos + 5)
        
        yPos += part.instructions ? 12 : 8

        part.questions.forEach((q) => {
          if (yPos > 270) { doc.addPage(); yPos = 20 }
          
          doc.setFont('helvetica', 'bold')
          doc.text(`${qNum}.`, 15, yPos)
          
          doc.setFont('helvetica', 'normal')
          const questionLines = doc.splitTextToSize(q.content, 170)
          doc.text(questionLines, 22, yPos)
          
          yPos += (questionLines.length * 5) + 4
          qNum++
        })
        yPos += 5
      })
      
      // Course Outcomes (if available)
      if (courseOutcomeAsset) {
        if (yPos > 260) { doc.addPage(); yPos = 20 }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('Course Outcomes', 15, yPos)
        yPos += 6

        if (courseOutcomeAsset.type === 'image' && courseOutcomeAsset.dataUrl) {
          const imgType = courseOutcomeAsset.ext === 'png' ? 'PNG' : 'JPEG'
          const imgProps = doc.getImageProperties(courseOutcomeAsset.dataUrl)
          const maxWidth = 180
          const scale = imgProps?.width ? maxWidth / imgProps.width : 1
          const imgWidth = imgProps?.width ? imgProps.width * scale : maxWidth
          const imgHeight = imgProps?.height ? imgProps.height * scale : 60

          if (yPos + imgHeight > 280) { doc.addPage(); yPos = 20 }
          doc.addImage(courseOutcomeAsset.dataUrl, imgType, 15, yPos, imgWidth, imgHeight)
          yPos += imgHeight + 6
        } else {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          const lines = doc.splitTextToSize(`Course outcome file: ${courseOutcomeAsset.filename}`, 180)
          doc.text(lines, 15, yPos)
          yPos += (lines.length * 5) + 2
        }
      }

      // Footer
      if (yPos > 280) { doc.addPage(); yPos = 20 }
      doc.line(10, yPos, 200, yPos)
      doc.setFont('helvetica', 'italic')
      doc.text('*** End of Question Paper ***', 105, yPos + 10, { align: 'center' })
    })

    doc.save(filename)
  }

  const downloadPaper = async (paper) => {
    try {
      await generatePDF([paper], `${formData.title.replace(/\s+/g, '_')}_${paper.setName}.pdf`)
      showToast(`${paper.setName} downloaded successfully!`, 'success')
    } catch (error) {
      console.error('Error downloading paper:', error)
      showToast('Failed to download paper', 'error')
    }
  }

  const downloadAllPapers = async () => {
    try {
      await generatePDF(generatedPapers, `${formData.title.replace(/\s+/g, '_')}_AllSets.pdf`)
      showToast(`All ${generatedPapers.length} sets downloaded successfully!`, 'success')
    } catch (error) {
      console.error('Error downloading all papers:', error)
      showToast('Failed to download papers', 'error')
    }
  }

  // ✅ Save papers to backend as PDF/DOCX
  const saveAllPapers = async () => {
    try {
      setSaving(true)
      const selectedBlueprint = blueprints.find(b => b.id === parseInt(formData.blueprintId))

      const totalMarks = selectedBlueprint?.parts?.reduce((sum, part) =>
        sum + (part.num_questions * part.marks_per_question), 0
      ) || selectedBlueprint?.total_marks || 100

      console.log('💾 Saving papers as', formData.outputFormat.toUpperCase())
      console.log('Total papers to save:', generatedPapers.length)

      for (const paper of generatedPapers) {
        // Map UI image source keys to backend API expected keys
        const mappedImageSources = formData.imageSources.map(s => {
          if (s === 'web') return 'web_search'
          if (s === 'book') return 'pdf_extraction'
          if (s === 'user') return 'user_uploaded'
          return s
        })

        const paperData = {
          title: `${formData.title} - ${paper.setName}`,
          subject_id: parseInt(formData.subjectId),
          blueprint_id: formData.blueprintId ? parseInt(formData.blueprintId) : null,
          exam_type: formData.examType || 'Regular',
          exam_date: formData.examDate || null,
          exam_duration: formData.examDuration || '3',
          total_marks: totalMarks,
          file_format: formData.outputFormat, // 'pdf' or 'docx'
          need_image: formData.needImage === 'yes',
          image_sources: mappedImageSources,
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
                difficulty: q.difficulty,
                blooms_level: q.bloomsLevel || null,
                source: q.source || null,
                image_id: q.image_id || null
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
      const questionsRes = await api.get(`/api/questions/bank/${formData.questionBankId}`)
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
              marks: q.marks,
              bloomsLevel: q.blooms_level || q.bloomsLevel || null
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
              paddingBottom: '1rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
                  {formData.title}
                </h2>
                <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.875rem' }}>
                  {formData.examType} | {generatedPapers.length} Set(s) | Image Req: {formData.needImage === 'yes' ? `Yes (${formData.imageSources.join(', ')})` : 'No'}
                </p>
              </div>

              {/* View Switcher: PDF vs Card Editor */}
              <div style={{
                display: 'inline-flex',
                background: '#f3f4f6',
                padding: '4px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <button
                  type="button"
                  onClick={async () => {
                    setPreviewView('pdf')
                    if (!pdfPreviewUrl && generatedPapers.length > 0) {
                      try {
                        const [{ jsPDF }] = await Promise.all([
                          import('jspdf'),
                          import('jspdf-autotable')
                        ])
                        // Generate PDF blob for live preview inside iframe
                        const selectedSubject = subjects.find(s => s.id === parseInt(formData.subjectId))
                        const doc = new jsPDF()
                        const examDate = formData.examDate ? new Date(formData.examDate).toLocaleDateString() : new Date().toLocaleDateString()

                        generatedPapers.forEach((paper, paperIndex) => {
                          if (paperIndex > 0) doc.addPage()
                          doc.setFont('helvetica', 'bold')
                          doc.setFontSize(14)
                          doc.text('SRI SHAKTHI INSTITUTE OF ENGINEERING AND TECHNOLOGY', 105, 17, { align: 'center' })
                          doc.setFontSize(11)
                          doc.text('(An Autonomous Institution)', 105, 23, { align: 'center' })
                          doc.setFont('helvetica', 'normal')
                          doc.setFontSize(8.5)
                          doc.text('Coimbatore - 641 062, Tamil Nadu, India', 105, 28, { align: 'center' })
                          doc.line(10, 32, 200, 32)
                          
                          doc.setFontSize(12)
                          doc.setFont('helvetica', 'bold')
                          doc.text(`${formData.title} (${paper.setName})`, 105, 42, { align: 'center' })
                          doc.setFontSize(10)
                          doc.setFont('helvetica', 'normal')
                          doc.text(`Subject: ${selectedSubject?.name || 'N/A'}`, 15, 50)
                          doc.text(`Date: ${examDate}`, 150, 50)
                          doc.line(10, 54, 200, 54)

                          let yPos = 65
                          let qNum = 1
                          paper.parts.forEach((part) => {
                            if (yPos > 260) { doc.addPage(); yPos = 20 }
                            doc.setFont('helvetica', 'bold')
                            doc.setFontSize(11)
                            doc.text(part.part_name, 15, yPos)
                            yPos += 8

                            part.questions.forEach((q) => {
                              if (yPos > 270) { doc.addPage(); yPos = 20 }
                              doc.setFont('helvetica', 'bold')
                              doc.text(`${qNum}.`, 15, yPos)
                              doc.setFont('helvetica', 'normal')
                              const lines = doc.splitTextToSize(q.content, 170)
                              doc.text(lines, 22, yPos)
                              yPos += (lines.length * 5) + 6
                              qNum++
                            })
                            yPos += 4
                          })
                        })

                        const blob = doc.output('blob')
                        setPdfPreviewUrl(URL.createObjectURL(blob))
                      } catch (e) {
                        console.error('PDF preview generation error:', e)
                      }
                    }
                  }}
                  className={`btn ${previewView === 'pdf' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderRadius: '6px' }}
                >
                  📄 Actual PDF Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewView('cards')}
                  className={`btn ${previewView === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderRadius: '6px' }}
                >
                  ✏️ Edit & Review Questions
                </button>
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

            {/* In-Website Live PDF Document Viewer */}
            {previewView === 'pdf' ? (
              <div style={{
                height: '70vh',
                border: '2px solid #cbd5e1',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#525659'
              }}>
                {pdfPreviewUrl ? (
                  <iframe
                    src={pdfPreviewUrl}
                    title="In-Website Question Paper PDF Preview"
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
                    <div className="spinner"></div> &nbsp; Preparing PDF Preview...
                  </div>
                )}
              </div>
            ) : null}

            {previewView === 'cards' && generatedPapers.map((paper, setIndex) => (
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

                              {/* Display question image if available */}
                              {questionImages[question.id] && (
                                <div style={{ 
                                  margin: '1rem 0',
                                  padding: '0.5rem',
                                  backgroundColor: '#f3f4f6',
                                  borderRadius: '4px',
                                  textAlign: 'center'
                                }}>
                                  <img 
                                    src={questionImages[question.id]} 
                                    alt="Question image"
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '300px',
                                      borderRadius: '4px',
                                      border: '1px solid #d1d5db'
                                    }}
                                  />
                                </div>
                              )}

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
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                id={`img-upload-${setIndex}-${partIndex}-${qIndex}`}
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleUploadImageForQuestion(setIndex, partIndex, qIndex, e.target.files[0])
                                  }
                                  e.target.value = ''
                                }}
                              />
                              <button
                                onClick={() => document.getElementById(`img-upload-${setIndex}-${partIndex}-${qIndex}`).click()}
                                className="btn btn-outline"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                title="Upload Image"
                                disabled={uploadingImageKey === `${setIndex}-${partIndex}-${qIndex}`}
                              >
                                {uploadingImageKey === `${setIndex}-${partIndex}-${qIndex}` ? (
                                  <div className="spinner" style={{ width: '14px', height: '14px', display: 'inline-block' }}></div>
                                ) : (
                                  <Upload size={14} />
                                )}
                              </button>
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

      <div className="card fade-in" style={{
        animationDelay: '0.3s',
        borderLeft: '4px solid var(--primary-400)'
      }}>
        <h3 style={{ color: 'var(--primary-700)', marginBottom: '1.25rem' }}>Image Options</h3>

        <div style={{ marginBottom: '1.25rem' }}>
          <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
            Need image in question paper? *
          </label>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
              <input
                type="radio"
                name="needImage"
                value="no"
                checked={formData.needImage === 'no'}
                onChange={() => setFormData(prev => ({ ...prev, needImage: 'no' }))}
              />
              <span>No</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
              <input
                type="radio"
                name="needImage"
                value="yes"
                checked={formData.needImage === 'yes'}
                onChange={() => setFormData(prev => ({ ...prev, needImage: 'yes' }))}
              />
              <span>Yes</span>
            </label>
          </div>
        </div>

        {formData.needImage === 'yes' && (
          <div style={{
            padding: '1.25rem',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #cbd5e1'
          }} className="fade-in">
            <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.75rem', display: 'block' }}>
              Image Source (Multi-Select) *
            </label>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '-0.25rem', marginBottom: '1rem' }}>
              Select any combination of image sources for multi-source image retrieval.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { id: 'web', label: 'Web Images', desc: 'Fetch relevant online images via web search' },
                { id: 'book', label: 'Book Images', desc: 'Extract figures & diagrams from uploaded textbook PDFs' },
                { id: 'user', label: 'User Uploaded Images', desc: 'Use images manually uploaded to your database library' }
              ].map(source => {
                const isChecked = formData.imageSources.includes(source.id)
                return (
                  <label
                    key={source.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.85rem',
                      borderRadius: '8px',
                      border: isChecked ? '2px solid var(--primary-500, #3b82f6)' : '1px solid #e2e8f0',
                      backgroundColor: isChecked ? '#eff6ff' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setFormData(prev => {
                          let nextSources = [...prev.imageSources]
                          if (checked) {
                            if (!nextSources.includes(source.id)) nextSources.push(source.id)
                          } else {
                            nextSources = nextSources.filter(id => id !== source.id)
                          }
                          return { ...prev, imageSources: nextSources }
                        })
                      }}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#1e293b' }}>
                        {source.label}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                        {source.desc}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
            {formData.needImage === 'yes' && formData.imageSources.length === 0 && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.75rem', marginBottom: 0 }}>
                ⚠️ Please select at least one image source when image option is enabled.
              </p>
            )}
          </div>
        )}
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