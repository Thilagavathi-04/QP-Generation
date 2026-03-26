import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Sidebar from './components/Navbar'
import WorkflowHeader from './components/WorkflowHeader'
import Dashboard from './pages/Dashboard'
import SubjectManagement from './pages/SubjectManagement'
import QuestionGeneration from './pages/QuestionGeneration'
import QuestionBank from './pages/QuestionBank'
import BlueprintManagement from './pages/BlueprintManagement'
import QuestionPaperGeneration from './pages/QuestionPaperGeneration'
import GeneratedPapers from './pages/GeneratedPapers'
// import Auth from './pages/Auth'
import AdminDashboard from './pages/AdminDashboard'
import GradingDashboard from './pages/GradingDashboard'
import EvaluationResults from './pages/EvaluationResults'
import ToastContainer from './components/Toast'
import './App.css'

const queryClient = new QueryClient()

function App() {
  // Simple auth state check
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('isAuthenticated') === 'true'
  );

  // Effect to listen for storage changes (implied login from Auth component if it doesn't do a full reload)
  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(localStorage.getItem('isAuthenticated') === 'true');
    };

    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  // if (!isAuthenticated) {
    // return (
    //   <QueryClientProvider client={queryClient}>
    //     <Router>
    //       <Routes>
    //         <Route path="*" element={<Auth />} />
    //       </Routes>
    //       <ToastContainer />
    //     </Router>
    //   </QueryClientProvider>
    // );
  // }

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="app">
          <Sidebar />
          <main className="main-content">
            <WorkflowHeader />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/subjects" element={<SubjectManagement />} />
              <Route path="/generate-questions/:subjectId" element={<QuestionGeneration />} />
              <Route path="/question-bank" element={<QuestionBank />} />
              <Route path="/question-bank/:subjectId" element={<QuestionBank />} />
              <Route path="/blueprints" element={<BlueprintManagement />} />
              <Route path="/generate-paper" element={<QuestionPaperGeneration />} />
              <Route path="/generated-papers" element={<GeneratedPapers />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/grading-dashboard" element={<GradingDashboard />} />
              <Route path="/evaluation-results/:paperId" element={<EvaluationResults />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <ToastContainer />
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App;
