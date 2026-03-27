import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import Sidebar from './components/Navbar'
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

const queryClient = new QueryClient()

// Restrict to Only Authenticated Users
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return (
    <div className="app">
      <Sidebar />
      <main className="main-content">
        <WorkflowHeader />
        {children}
      </main>
      <ToastContainer />
    </div>
  );
};

// Restrict to Only Admins
const AdminRoute = ({ children }) => {
  const { currentUser, isAdmin } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
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

              {/* Admin Only Routes */}
              <Route path="/blueprints" element={<PrivateRoute><AdminRoute><BlueprintManagement /></AdminRoute></PrivateRoute>} />
              <Route path="/admin" element={<PrivateRoute><AdminRoute><AdminDashboard /></AdminRoute></PrivateRoute>} />
              <Route path="/add-profile" element={<PrivateRoute><AdminRoute><AdminProfile /></AdminRoute></PrivateRoute>} />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App;
