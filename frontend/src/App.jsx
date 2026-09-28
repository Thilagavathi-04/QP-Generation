import React, { Suspense, lazy, useState, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import Sidebar from './components/Navbar'
import Topbar from './components/Topbar'
import WorkflowHeader from './components/WorkflowHeader'
import ToastContainer from './components/Toast'
import './App.css'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const SubjectManagement = lazy(() => import('./pages/SubjectManagement'))
const QuestionGeneration = lazy(() => import('./pages/QuestionGeneration'))
const QuestionBank = lazy(() => import('./pages/QuestionBank'))
const BlueprintManagement = lazy(() => import('./pages/BlueprintManagement'))
const QuestionPaperGeneration = lazy(() => import('./pages/QuestionPaperGeneration'))
const GeneratedPapers = lazy(() => import('./pages/GeneratedPapers'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminProfile = lazy(() => import('./pages/AdminProfile'))
const GradingDashboard = lazy(() => import('./pages/GradingDashboard'))
const EvaluationResults = lazy(() => import('./pages/EvaluationResults'))
const Login = lazy(() => import('./pages/login'))
const Profile = lazy(() => import('./pages/Profile'))
const About = lazy(() => import('./pages/About'))

const queryClient = new QueryClient()

// The app shell: sidebar spine, topbar and page frame.
const Shell = ({ children }) => {
  // The drawer is keyed to the route it was opened on, so navigating away
  // closes it without an effect having to sync state.
  const [openedFor, setOpenedFor] = useState(null)
  const location = useLocation()
  const navOpen = openedFor === location.pathname
  const wasOpen = useRef(false)

  useEffect(() => {
    if (navOpen) {
      wasOpen.current = true
      document.body.style.overflow = 'hidden'
      document.getElementById('nav-close')?.focus()
      const onKey = (event) => {
        if (event.key === 'Escape') setOpenedFor(null)
      }
      window.addEventListener('keydown', onKey)
      return () => {
        window.removeEventListener('keydown', onKey)
        document.body.style.overflow = ''
      }
    }
    document.body.style.overflow = ''
    if (wasOpen.current) {
      wasOpen.current = false
      document.getElementById('nav-toggle')?.focus()
    }
  }, [navOpen])

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar
        open={navOpen}
        onClose={() => setOpenedFor(null)}
      />
      <div className="main-col">
        <Topbar
          open={navOpen}
          onToggle={() => setOpenedFor(navOpen ? null : location.pathname)}
        />
        <main id="main-content" className="main-content" tabIndex={-1}>
          <WorkflowHeader />
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}

// Restrict to Only Authenticated Users
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
};

// Restrict to Only Admins
const AdminRoute = ({ children }) => {
  const { currentUser, isAdmin } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
};

// Restrict to specific roles (e.g. admin + hod)
const RoleRoute = ({ roles, children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  const role = currentUser.role === 'advisor' ? 'staff' : currentUser.role;
  if (!roles.includes(role)) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Suspense fallback={<div className="loading">Loading...</div>}>
            <Routes>
              <Route path="/login" element={
                <>
                  <Login />
                  <ToastContainer />
                </>
              } />

              {/* Protected General/Faculty Routes */}
              <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/subjects" element={<PrivateRoute><SubjectManagement /></PrivateRoute>} />
              <Route path="/generate-questions/:subjectId" element={<PrivateRoute><QuestionGeneration /></PrivateRoute>} />
              <Route path="/question-bank" element={<PrivateRoute><QuestionBank /></PrivateRoute>} />
              <Route path="/question-bank/:subjectId" element={<PrivateRoute><QuestionBank /></PrivateRoute>} />
              <Route path="/generate-paper" element={<PrivateRoute><QuestionPaperGeneration /></PrivateRoute>} />
              <Route path="/generated-papers" element={<PrivateRoute><GeneratedPapers /></PrivateRoute>} />
              <Route path="/grading-dashboard" element={<PrivateRoute><GradingDashboard /></PrivateRoute>} />
              <Route path="/evaluation-results/:paperId" element={<PrivateRoute><EvaluationResults /></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
              <Route path="/about" element={<PrivateRoute><About /></PrivateRoute>} />

              {/* Admin Only Routes */}
              <Route path="/blueprints" element={<PrivateRoute><AdminRoute><BlueprintManagement /></AdminRoute></PrivateRoute>} />
              {/* Admin + HOD Routes (user management) */}
              <Route path="/admin" element={<PrivateRoute><RoleRoute roles={['admin', 'hod']}><AdminDashboard /></RoleRoute></PrivateRoute>} />
              <Route path="/add-profile" element={<PrivateRoute><RoleRoute roles={['admin', 'hod']}><AdminProfile /></RoleRoute></PrivateRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App;
