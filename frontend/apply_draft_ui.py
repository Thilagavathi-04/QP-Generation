import re

with open('frontend/src/pages/QuestionGeneration.jsx', 'r') as f:
    content = f.read()

# Replace Load draft
load_old = """  // Load draft on mount
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
  }, [subjectId])"""

load_new = """  // Load draft on mount
  useEffect(() => {
    if (subjectId) {
      subjectAPI.getUserDraft(subjectId).then(res => {
        if (res.data.success) {
          const savedStr = res.data.draft_data || localStorage.getItem(`generation_draft_${subjectId}`);
          if (savedStr) {
            try {
              const parsed = JSON.parse(savedStr)
              if (parsed.unitRange) setUnitRange(parsed.unitRange)
              if (parsed.parts) setParts(parsed.parts)
              if (res.data.active_job_id) {
                 setActiveJobId(res.data.active_job_id)
              } else if (parsed.activeJobId) {
                 setActiveJobId(parsed.activeJobId)
              }
              if (parsed.jobPartIndex !== undefined) setJobPartIndex(parsed.jobPartIndex)
              if (parsed.isAllPartsJob !== undefined) setIsAllPartsJob(parsed.isAllPartsJob)
              if (parsed.isRefreshing !== undefined) setIsRefreshing(parsed.isRefreshing)
              if (parsed.removedTopicIds) setRemovedTopicIds(new Set(parsed.removedTopicIds))
            } catch (e) {
              console.error("Error parsing saved draft", e)
            }
          }
        }
      }).catch(err => {
        console.error("Error fetching user draft", err)
      });
    }
  }, [subjectId])"""

content = content.replace(load_old, load_new)

# Replace Save draft
save_old = """  // Save draft on change
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
  }, [subjectId, unitRange, parts, activeJobId, jobPartIndex, isAllPartsJob, isRefreshing, removedTopicIds])"""

save_new = """  // Save draft on change
  useEffect(() => {
    if (subjectId) {
      const draftObj = {
        unitRange,
        parts,
        activeJobId,
        jobPartIndex,
        isAllPartsJob,
        isRefreshing,
        removedTopicIds: Array.from(removedTopicIds)
      };
      const draftStr = JSON.stringify(draftObj);
      localStorage.setItem(`generation_draft_${subjectId}`, draftStr)
      
      const timer = setTimeout(() => {
         subjectAPI.saveUserDraft(subjectId, draftStr).catch(e => console.error("Error saving draft to backend", e));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [subjectId, unitRange, parts, activeJobId, jobPartIndex, isAllPartsJob, isRefreshing, removedTopicIds])"""

content = content.replace(save_old, save_new)

with open('frontend/src/pages/QuestionGeneration.jsx', 'w') as f:
    f.write(content)
print("Applied QuestionGeneration.jsx changes")
