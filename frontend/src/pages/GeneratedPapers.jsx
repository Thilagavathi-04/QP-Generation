import { useState, useEffect } from 'react'
import { Download, Trash2, Calendar, FileText, Award, ClipboardList } from 'lucide-react'
import api from '../utils/api'

const GeneratedPapers = () => {
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPapers()
  }, [])

  const fetchPapers = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/question-papers')
      setPapers(response.data)
      setError(null)
    } catch (err) {
      console.error('Error fetching papers:', err)
      setError('Failed to load question papers')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (paper) => {
    try {
      const response = await api.get(`/api/question-papers/${paper.id}/download`, {
        responseType: 'blob'
      })

      const contentDisposition = response.headers['content-disposition']
      let filename = `${paper.title}.${paper.file_format || 'pdf'}`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1]
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading paper:', err)
      alert('Failed to download the question paper. Please try again.')
    }
  }

  const handleDelete = async (paperId) => {
    if (!window.confirm('Are you sure you want to delete this question paper?')) {
      return
    }

    try {
      await api.delete(`/api/question-papers/${paperId}`)
      setPapers(papers.filter(p => p.id !== paperId))
      alert('Question paper deleted successfully!')
    } catch (err) {
      console.error('Error deleting paper:', err)
      alert('Failed to delete the question paper. Please try again.')
    }
  }

  const handleDownloadScript = async (paper) => {
    try {
      const response = await api.get(`/api/answer-scripts/${paper.id}`);
      let data = response.data.answer_data;
      let answers = typeof data === 'string' ? JSON.parse(data) : data;

      if (answers && !Array.isArray(answers) && answers.answers) {
        answers = answers.answers;
      }

      if (!Array.isArray(answers)) {
        alert('Internal Error: Answer script not found for this paper.');
        return;
      }

      // Generate TXT content
      let content = `OFFICIAL ANSWER KEY: ${paper.title}\n`;
      content += `Generated on: ${new Date().toLocaleString()}\n`;
      content += `================================================================================\n\n`;

      answers.forEach((item, idx) => {
        content += `QUESTION ${idx + 1} (${item.marks} Marks)\n`;
        content += `--------------------------------------------------------------------------------\n`;
        content += `${item.question}\n\n`;
        content += `MODEL ANSWER:\n`;
        content += `${item.answer}\n\n`;
        if (item.expected_points) {
          content += `EXPECTED POINTS / KEYWORDS:\n`;
          content += `${item.expected_points}\n`;
        }
        content += `\n${'='.repeat(80)}\n\n`;
      });

      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Answer_Key_${paper.title.replace(/\s+/g, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading script:', err);
      alert('Answer script not available for this paper. Generate it in the Grading Dashboard first.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'N/A'
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div className="spinner"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: '#fee',
        border: '1px solid #fcc',
        color: '#c33',
        padding: '1rem',
        borderRadius: '8px',
        margin: '2rem'
      }}>
        <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Error</p>
        <p style={{ fontSize: '0.875rem' }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{
      padding: '2rem',
      width: '100%'
    }}>
      {/* Header */}
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
          alignItems: 'center',
          justifyContent: 'space-between',
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
            }}>Generated Question Papers</h1>
            <p style={{ opacity: 0.95, fontSize: '0.95rem' }}>
              View, download, and manage your generated exam papers
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.875rem 1.5rem',
            background: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>
            <FileText style={{ width: '24px', height: '24px' }} />
            <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>
              {papers.length}
            </span>
            <span style={{ fontSize: '0.875rem', opacity: 0.95 }}>
              Total Papers
            </span>
          </div>
        </div>
      </div>

      {/* Papers Table */}
      {papers.length === 0 ? (
        <div className="card fade-in" style={{
          textAlign: 'center',
          padding: '3rem',
          background: 'var(--gradient-pastel-light)',
          border: '2px dashed var(--primary-200)'
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
            <FileText style={{ width: '40px', height: '40px', color: 'white' }} />
          </div>
          <p style={{
            color: 'var(--primary-700)',
            fontSize: '1.25rem',
            fontWeight: '600',
            marginBottom: '0.5rem'
          }}>No question papers generated yet</p>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Generate your first paper from the Question Paper Generation page
          </p>
        </div>
      ) : (
        <div className="card fade-in" style={{
          animationDelay: '0.1s',
          padding: '0',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '800px'
            }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={{
                    padding: '1rem 1.5rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Title
                  </th>
                  <th style={{
                    padding: '1rem 1.5rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Exam Type
                  </th>
                  <th style={{
                    padding: '1rem 1.5rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Date
                  </th>
                  <th style={{
                    padding: '1rem 1.5rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Marks
                  </th>
                  <th style={{
                    padding: '1rem 1.5rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Generated
                  </th>
                  <th style={{
                    padding: '1rem 1.5rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {papers.map((paper) => (
                  <tr
                    key={paper.id}
                    style={{ borderBottom: '1px solid #e5e7eb' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <FileText style={{
                          width: '20px',
                          height: '20px',
                          color: 'var(--primary-500)',
                          marginRight: '0.75rem',
                          flexShrink: 0
                        }} />
                        <span style={{
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: '#1f2937'
                        }}>{paper.title}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--rose-100)',
                        color: 'var(--primary-800)',
                        display: 'inline-block'
                      }}>
                        {paper.exam_type || 'Regular'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Calendar style={{ width: '16px', height: '16px', marginRight: '0.25rem', color: '#9ca3af' }} />
                        {formatDate(paper.exam_date)}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--success-600)'
                      }}>
                        <Award style={{ width: '16px', height: '16px', marginRight: '0.25rem' }} />
                        {paper.total_marks || 'N/A'}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      {formatDate(paper.generated_at)}
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleDownload(paper)}
                          className="btn btn-primary"
                          style={{
                            fontSize: '0.875rem',
                            padding: '0.5rem 1rem'
                          }}
                          title="Download Paper"
                        >
                          <Download style={{ width: '16px', height: '16px' }} />
                          Question Paper
                        </button>
                        <button
                          onClick={() => handleDownloadScript(paper)}
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.875rem',
                            padding: '0.5rem 1rem'
                          }}
                          title="Download Answer Script"
                        >
                          <ClipboardList style={{ width: '16px', height: '16px' }} />
                          Answer Key
                        </button>
                        <button
                          onClick={() => handleDelete(paper.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.5rem 0.75rem',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#b91c1c'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#dc2626'}
                          title="Delete Paper"
                        >
                          <Trash2 style={{ width: '16px', height: '16px' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default GeneratedPapers