import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Circle,
    ChevronRight,
    ChevronLeft,
    ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

const allSteps = [
    { id: 'subjects', label: 'Subjects', path: '/subjects' },
    { id: 'questions', label: 'Questions', path: '/question-bank' },
    { id: 'blueprints', label: 'Blueprints', path: '/blueprints' },
    { id: 'papers', label: 'Generate Paper', path: '/generate-paper' },
    { id: 'grading', label: 'Grading', path: '/grading-dashboard' }
];

const WorkflowHeader = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAdmin } = useAuth();

    // Hide the Blueprints step from non-admins
    const steps = isAdmin ? allSteps : allSteps.filter(s => s.id !== 'blueprints');

    const getCurrentStepIndex = () => {
        const path = location.pathname;
        const match = (prefix) => path.startsWith(prefix);
        if (match('/subjects')) return steps.findIndex(s => s.id === 'subjects');
        if (match('/generate-questions') || match('/question-bank')) return steps.findIndex(s => s.id === 'questions');
        if (match('/blueprints')) return steps.findIndex(s => s.id === 'blueprints');
        if (match('/generate-paper') || match('/generated-papers')) return steps.findIndex(s => s.id === 'papers');
        if (match('/grading-dashboard') || match('/evaluation-results')) return steps.findIndex(s => s.id === 'grading');
        return -1;
    };

    const currentIndex = getCurrentStepIndex();

    if (currentIndex === -1) return null;

    const handleNext = () => {
        if (currentIndex < steps.length - 1) {
            navigate(steps[currentIndex + 1].path);
        }
    };

    const handleBack = () => {
        if (currentIndex > 0) {
            navigate(steps[currentIndex - 1].path);
        }
    };

    return (
        <div className="workflow-container" style={{ marginBottom: '2rem' }}>
            <div className="workflow-nav">
                {steps.map((step, index) => (
                    <React.Fragment key={step.id}>
                        <div
                            className={`workflow-step ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'completed' : ''}`}
                            onClick={() => navigate(step.path)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="workflow-dot-container">
                                <div className={`workflow-dot ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'completed' : ''}`} />
                            </div>
                            <span>{step.label}</span>
                        </div>
                        {index < steps.length - 1 && (
                            <ChevronRight size={14} className="workflow-separator" style={{ color: '#cbd5e1' }} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            <div className="workflow-actions" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'white',
                padding: '1rem 1.5rem',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                <button
                    onClick={handleBack}
                    disabled={currentIndex === 0}
                    className="btn btn-outline"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                    <ChevronLeft size={16} />
                    Back
                </button>

                <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9rem' }}>
                    Step {currentIndex + 1}: {steps[currentIndex].label}
                </div>

                <button
                    onClick={handleNext}
                    disabled={currentIndex === steps.length - 1}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                    Next
                    <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
};

export default WorkflowHeader;
