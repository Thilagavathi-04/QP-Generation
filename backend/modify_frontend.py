import re

filepath = 'frontend/src/pages/QuestionGeneration.jsx'
with open(filepath, 'r') as f:
    content = f.read()

# 1. Add new state variables right after setUnitRange
state_injection = """  const [unitRange, setUnitRange] = useState({ from: '', to: '' })
  const [activeJobId, setActiveJobId] = useState(null)
  const [pollingStatus, setPollingStatus] = useState('')
  const [jobPartIndex, setJobPartIndex] = useState(null)
  const [isAllPartsJob, setIsAllPartsJob] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
"""
content = content.replace("  const [unitRange, setUnitRange] = useState({ from: '', to: '' })", state_injection)

# 2. Add useEffects for localStorage and Polling right before fetchSubjectData
use_effects_injection = """  // Load draft on mount
  useEffect(() => {
    if (subjectId) {
      const saved = localStorage.getItem(`generation_draft_${subjectId}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.unitRange) setUnitRange(parsed.unitRange)
          if (parsed.parts) setParts(parsed.parts)
          if (parsed.activeJobId) setActiveJobId(parsed.activeJobId)
          if (parsed.jobPartIndex !== undefined) setJobPartIndex(parsed.jobPartIndex)
          if (parsed.isAllPartsJob !== undefined) setIsAllPartsJob(parsed.isAllPartsJob)
          if (parsed.isRefreshing !== undefined) setIsRefreshing(parsed.isRefreshing)
          if (parsed.removedTopicIds) setRemovedTopicIds(new Set(parsed.removedTopicIds))
        } catch (e) {
          console.error("Error parsing saved draft", e)
        }
      }
    }
  }, [subjectId])

  // Save draft on change
  useEffect(() => {
    if (subjectId) {
      localStorage.setItem(`generation_draft_${subjectId}`, JSON.stringify({
        unitRange,
        parts,
        activeJobId,
        jobPartIndex,
        isAllPartsJob,
        isRefreshing,
        removedTopicIds: Array.from(removedTopicIds)
      }))
    }
  }, [subjectId, unitRange, parts, activeJobId, jobPartIndex, isAllPartsJob, isRefreshing, removedTopicIds])

  // Polling mechanism
  useEffect(() => {
    let intervalId;
    if (activeJobId) {
      setIsGenerating(true);
      intervalId = setInterval(async () => {
        try {
          const response = await api.get(`/api/jobs/${activeJobId}`);
          if (response.data.status === 'completed') {
            clearInterval(intervalId);
            setIsGenerating(false);
            setPollingStatus('');
            
            if (isAllPartsJob) {
               const result = response.data.result;
               if (result && result.success) {
                 setParts(prev => {
                   const newParts = [...prev]
                   result.parts.forEach((partResult, pIndex) => {
                     if (partResult.success) {
                        const generatedQuestions = partResult.questions.map((q, i) => ({
                          id: `${pIndex}-${i}-${Date.now()}-${Math.random()}`,
                          content: q.content,
                          unit: q.unit,
                          topic: q.topic,
                          difficulty: q.difficulty || newParts[pIndex].difficulty,
                          marks: q.marks || newParts[pIndex].markPerQuestion,
                          bloomsLevel: q.blooms_level || null,
                        }))
                        if (isRefreshing) {
                          const selectedQuestions = [...(newParts[pIndex].selectedQuestions || [])]
                          newParts[pIndex].generatedQuestions = [...selectedQuestions, ...generatedQuestions]
                        } else {
                          newParts[pIndex].generatedQuestions = generatedQuestions
                          newParts[pIndex].selectedQuestions = []
                        }
                     }
                   })
                   return newParts
                 })
                 showToast(`Generated questions successfully!`, 'success')
               }
            } else {
               const result = response.data.result;
               if (result && result.success) {
                 const generatedQuestions = result.questions.map((q, i) => ({
                    id: `${jobPartIndex}-${i}-${Date.now()}-${Math.random()}`,
                    content: q.content,
                    unit: q.unit,
                    topic: q.topic,
                    // Use standard lookup since difficulty could be absent
                    difficulty: q.difficulty || "medium",
                    marks: q.marks || 0,
                    bloomsLevel: q.blooms_level || null,
                 }))

                 setParts(prev => {
                    const newParts = [...prev]
                    const targetPart = newParts[jobPartIndex] || {}
                    // fix difficulty/marks fallback
                    generatedQuestions.forEach(q => {
                        q.difficulty = q.difficulty === "medium" ? (targetPart.difficulty || "medium") : q.difficulty
                        q.marks = q.marks === 0 ? (targetPart.markPerQuestion || 0) : q.marks
                    })

                    if (isRefreshing) {
                      const selectedQuestions = [...(targetPart.selectedQuestions || [])]
                      targetPart.generatedQuestions = [...selectedQuestions, ...generatedQuestions]
                    } else {
                      targetPart.generatedQuestions = generatedQuestions
                      targetPart.selectedQuestions = []
                    }
                    newParts[jobPartIndex] = targetPart
                    return newParts
                 })
                 showToast(`Generated ${generatedQuestions.length} questions successfully!`, 'success')
               }
            }
            setActiveJobId(null)
          } else if (response.data.status === 'failed') {
            clearInterval(intervalId);
            setIsGenerating(false);
            setPollingStatus('');
            setActiveJobId(null);
            showToast('Failed to generate questions: ' + (response.data.error || 'Unknown error'), 'error', 5000)
          } else {
            setPollingStatus('Generating in background (You can safely navigate away)...');
          }
        } catch (error) {
           console.error("Error polling job", error);
        }
      }, 3000);
    } else {
      setIsGenerating(false);
      setPollingStatus('');
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeJobId, isAllPartsJob, jobPartIndex, isRefreshing]);

  const fetchSubjectData = async () => {"""
content = content.replace("  const fetchSubjectData = async () => {", use_effects_injection)


# 3. Rewrite generateQuestions
generate_q_pattern = re.compile(
    r'  const generateQuestions = async \(partIndex, refresh = false\) => \{\n'
    r'.*?finally \{\n      setIsGenerating\(false\)\n    \}\n  \}',
    re.DOTALL
)

generate_q_replacement = """  const generateQuestions = async (partIndex, refresh = false) => {
    if (parts.length === 0) {
      showToast('Please add at least one part first', 'warning')
      return
    }

    if (!unitRange.from || !unitRange.to) {
      showToast('Please select unit range first', 'warning')
      return
    }

    const effectiveNeeded = getQuestionsNeeded(parts[partIndex])
    const questionsToGenerate = refresh
      ? parts[partIndex].questionsNeeded - (parts[partIndex].selectedQuestions || []).length
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
        topics: selectedTopicNames.length > 0 ? selectedTopicNames : null,
        plan: parts[partIndex].plan && parts[partIndex].plan.length > 0 ? parts[partIndex].plan : undefined,
      })

      if (response.data.success && response.data.job_id) {
        setIsAllPartsJob(false)
        setJobPartIndex(partIndex)
        setIsRefreshing(refresh)
        setActiveJobId(response.data.job_id)
        showToast('Generation started in background', 'info')
      }
    } catch (error) {
      console.error('Error starting generation:', error)
      showToast('Failed to start generation: ' + (error.response?.data?.detail || 'Unknown error'), 'error', 5000)
    }
  }"""

content = generate_q_pattern.sub(generate_q_replacement, content)


# 4. Rewrite generateAllParts
generate_all_pattern = re.compile(
    r'  const generateAllParts = async \(refresh = false\) => \{\n'
    r'.*?finally \{\n      setIsGenerating\(false\)\n    \}\n  \}',
    re.DOTALL
)

generate_all_replacement = """  const generateAllParts = async (refresh = false) => {
    if (parts.length === 0) {
      showToast('Please add at least one part first', 'warning')
      return
    }

    if (!unitRange.from || !unitRange.to) {
      showToast('Please select unit range first', 'warning')
      return
    }

    const selectedTopicNames = topics
      .filter(t => !t.deselected)
      .map(t => `${t.topic_name} (Unit ${t.unit_number})`)

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

      if (response.data.success && response.data.job_id) {
        setIsAllPartsJob(true)
        setIsRefreshing(refresh)
        setActiveJobId(response.data.job_id)
        showToast('Generation for all parts started in background', 'info')
      }
    } catch (error) {
      console.error('Error starting generation:', error)
      showToast('Failed to start generation: ' + (error.response?.data?.detail || 'Unknown error'), 'error', 5000)
    }
  }"""

content = generate_all_pattern.sub(generate_all_replacement, content)


# 5. Fix UI to show pollingStatus if available
status_pattern = re.compile(
    r'\{isGenerating \? \(\s*<>\s*<RefreshCw className="spin".*?>.*?</>\s*\)\s*:\s*\(\s*<>\s*<RefreshCw size=\{16\}.*?>.*?</>\s*\)\}'
)
# We will just replace it with `isGenerating ? "Generating..." : "Generate"` but let's be careful.
# Actually it's easier to add the polling status text somewhere in the UI, like in the header or near the generate button.
ui_injection = """        {pollingStatus && (
          <div className="alert alert-info" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw className="spin" size={16} />
            {pollingStatus}
          </div>
        )}"""

content = content.replace("        {subject.use_book_for_generation && (", ui_injection + "\n\n        {subject.use_book_for_generation && (")


with open(filepath, 'w') as f:
    f.write(content)

print("Modification complete.")
