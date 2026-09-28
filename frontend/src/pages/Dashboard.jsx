import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Archive, TrendingUp, Database, Layout, Plus, ChevronRight } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../context/useAuth'

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8010'

const Dashboard = () => {
  const { isAdmin } = useAuth()
  const [stats, setStats] = useState({
    totalSubjects: 0,
    totalQuestions: 0,
    totalBlueprints: 0,
    generatedPapers: 0
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchDashboardData() {
    try {
      setLoading(true)

      const statsRes = await axios.get(`${API_URL}/api/dashboard/stats`)
      setStats({
        totalSubjects: statsRes.data.subjects,
        totalQuestions: statsRes.data.questions,
        totalBlueprints: statsRes.data.blueprints,
        generatedPapers: statsRes.data.papers
      })

      const activityRes = await axios.get(`${API_URL}/api/dashboard/recent-activity`)
      setRecentActivity(activityRes.data)

      setLoading(false)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboardData()
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now - time
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Create and manage question papers for your subjects.
        </p>
      </header>

      {/* Statistics */}
      <div className="stats-grid">
        <Link to="/subjects" className="stat-card">
          <div className="stat-value">{stats.totalSubjects}</div>
          <div className="stat-label">
            Subjects
            <ChevronRight size={16} aria-hidden="true" />
          </div>
        </Link>

        <Link to="/question-bank" className="stat-card">
          <div className="stat-value">{stats.totalQuestions}</div>
          <div className="stat-label">
            Questions
            <ChevronRight size={16} aria-hidden="true" />
          </div>
        </Link>

        {isAdmin && (
          <Link to="/blueprints" className="stat-card">
            <div className="stat-value">{stats.totalBlueprints}</div>
            <div className="stat-label">
              Blueprints
              <ChevronRight size={16} aria-hidden="true" />
            </div>
          </Link>
        )}

        <Link to="/generated-papers" className="stat-card">
          <div className="stat-value">{stats.generatedPapers}</div>
          <div className="stat-label">
            Question papers
            <ChevronRight size={16} aria-hidden="true" />
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Quick actions</h2>
        </div>

        <div className="quick-actions">
          <Link to="/generate-paper" className="btn btn-primary">
            <Plus size={18} aria-hidden="true" />
            Generate paper
          </Link>

          <Link to="/subjects" className="btn btn-outline">
            <BookOpen size={18} aria-hidden="true" />
            Manage subjects
          </Link>

          <Link to="/question-bank" className="btn btn-outline">
            <Database size={18} aria-hidden="true" />
            Question bank
          </Link>

          {isAdmin && (
            <Link to="/blueprints" className="btn btn-outline">
              <Layout size={18} aria-hidden="true" />
              Blueprints
            </Link>
          )}

          <Link to="/generated-papers" className="btn btn-outline">
            <Archive size={18} aria-hidden="true" />
            All papers
          </Link>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Recent activity</h2>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner" />
            <p>Loading activity…</p>
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="empty-block">
            <TrendingUp size={48} aria-hidden="true" />
            <p>No activity yet. Start by adding subjects or importing questions.</p>
            <Link to="/subjects" className="btn btn-primary">
              Add a subject
            </Link>
          </div>
        ) : (
          <ul className="activity-list">
            {recentActivity.map((activity, index) => (
              <li key={index} className="activity-item">
                <div>
                  <div className="activity-action">{activity.action}</div>
                  <div className="activity-subject">Subject: {activity.subject}</div>
                </div>
                <div className="activity-time">{formatTimeAgo(activity.time)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default Dashboard