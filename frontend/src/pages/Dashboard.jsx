import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, BookOpen, FileText, Archive, TrendingUp, Database, Layout } from 'lucide-react'
import axios from 'axios'

const API_URL = 'http://127.0.0.1:8010'

const Dashboard = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalSubjects: 0,
    totalQuestions: 0,
    totalBlueprints: 0,
    generatedPapers: 0
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch stats
      const statsRes = await axios.get(`${API_URL}/api/dashboard/stats`)
      setStats({
        totalSubjects: statsRes.data.subjects,
        totalQuestions: statsRes.data.questions,
        totalBlueprints: statsRes.data.blueprints,
        generatedPapers: statsRes.data.papers
      })

      // Fetch recent activity
      const activityRes = await axios.get(`${API_URL}/api/dashboard/recent-activity`)
      setRecentActivity(activityRes.data)

      setLoading(false)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setLoading(false)
    }
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now - time
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2.25rem',
          fontWeight: '700',
          color: 'var(--secondary-900)',
          margin: 0
        }}>DASHBOARD</h1>
      </div>

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2.5rem'
      }}>
        <div
          onDoubleClick={() => navigate('/subjects')}
          className="stat-card fade-in"
          style={{
            background: 'var(--gradient-rose-deep)',
            animationDelay: '0.1s',
            cursor: 'pointer'
          }}
          title="Double click to manage subjects"
        >
          <div className="stat-value">{stats.totalSubjects}</div>
          <div className="stat-label">TOTAL SUBJECTS</div>
        </div>

        <div
          onDoubleClick={() => navigate('/question-bank')}
          className="stat-card fade-in"
          style={{
            background: 'var(--gradient-peach-contrast)',
            animationDelay: '0.2s',
            cursor: 'pointer'
          }}
          title="Double click to view question bank"
        >
          <div className="stat-value">{stats.totalQuestions}</div>
          <div className="stat-label">TOTAL QUESTIONS</div>
        </div>

        <div
          onDoubleClick={() => navigate('/blueprints')}
          className="stat-card fade-in"
          style={{
            background: 'var(--gradient-sage-contrast)',
            animationDelay: '0.3s',
            cursor: 'pointer'
          }}
          title="Double click to manage blueprints"
        >
          <div className="stat-value">{stats.totalBlueprints}</div>
          <div className="stat-label">BLUEPRINTS</div>
        </div>

        <div
          onDoubleClick={() => navigate('/generated-papers')}
          className="stat-card fade-in"
          style={{
            background: 'var(--gradient-sand-contrast)',
            animationDelay: '0.4s',
            cursor: 'pointer'
          }}
          title="Double click to view generated papers"
        >
          <div className="stat-value">{stats.generatedPapers}</div>
          <div className="stat-label">GENERATED PAPERS</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card slide-up" style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--secondary-800)',
          marginBottom: '1.5rem'
        }}>Quick Actions</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem'
        }}>
          <Link to="/subjects" className="btn btn-primary" style={{
            padding: '1rem 0.5rem',
            fontSize: '0.9rem'
          }}>
            <BookOpen size={18} />
            Manage Subjects
          </Link>

          <Link to="/question-bank" className="btn" style={{
            padding: '1rem 0.5rem',
            fontSize: '0.9rem',
            background: 'var(--gradient-peach-contrast)',
            color: 'white'
          }}>
            <Database size={18} />
            Manage Question Bank
          </Link>

          <Link to="/blueprints" className="btn btn-success" style={{
            padding: '1rem 0.5rem',
            fontSize: '0.9rem'
          }}>
            <Layout size={18} />
            Manage Blueprints
          </Link>

          <Link to="/generated-papers" className="btn btn-warning" style={{
            padding: '1rem 0.5rem',
            fontSize: '0.9rem'
          }}>
            <Archive size={18} />
            View Papers
          </Link>

          <Link to="/generate-paper" className="btn btn-secondary" style={{
            padding: '1rem 0.5rem',
            fontSize: '0.9rem'
          }}>
            <Plus size={18} />
            Generate Paper
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card slide-up" style={{ animationDelay: '0.2s' }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#1f2937',
          marginBottom: '1.5rem'
        }}>Recent Activity</h2>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading activity...</p>
          </div>
        ) : recentActivity.length === 0 ? (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '1rem'
          }}>
            <TrendingUp size={48} style={{
              margin: '0 auto 1rem',
              color: '#d1d5db',
              display: 'block'
            }} />
            No recent activity yet. Start by adding subjects or generating questions!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f9fafb'
                  e.currentTarget.style.borderColor = '#06b6d4'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.borderColor = '#e5e7eb'
                }}
              >
                <div>
                  <div style={{
                    fontWeight: '600',
                    color: 'var(--secondary-900)',
                    marginBottom: '0.25rem'
                  }}>
                    {activity.action}
                  </div>
                  <div style={{
                    color: 'var(--secondary-500)',
                    fontSize: '0.875rem'
                  }}>
                    Subject: {activity.subject}
                  </div>
                </div>
                <div style={{
                  color: 'var(--primary-500)',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  {formatTimeAgo(activity.time)}
                </div>
              </div>
            ))}
          </div>
        )
        }
      </div >
    </div >
  )
}

export default Dashboard