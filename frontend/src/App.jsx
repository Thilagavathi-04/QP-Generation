import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Navbar'
import WorkflowHeader from './components/WorkflowHeader'
import Dashboard from './pages/Dashboard'
import SubjectManagement from './pages/SubjectManagement'
import QuestionGeneration from './pages/QuestionGeneration'
import QuestionBank from './pages/QuestionBank'
import BlueprintManagement from './pages/BlueprintManagement'
import QuestionPaperGeneration from './pages/QuestionPaperGeneration'
import GeneratedPapers from './pages/GeneratedPapers'
import AdminDashboard from './pages/AdminDashboard'
import AdminProfile from './pages/AdminProfile'
import GradingDashboard from './pages/GradingDashboard'
import EvaluationResults from './pages/EvaluationResults'
import Login from './pages/Login'
import Profile from './pages/Profile'
import ToastContainer from './components/Toast'
import './App.css'

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
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App;
