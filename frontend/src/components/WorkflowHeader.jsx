import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronRight,
    ChevronLeft,
    ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

const allSteps = [
    { id: 'subjects', label: 'Subjects', path: '/subjects' },
    { id: 'questions', label: 'Questions', path: '/question-bank' },
    { id: 'blueprints', label: 'Blueprints', path: '/blueprints' },
    { id: 'papers', label: 'Generate paper', path: '/generate-paper' },
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
        <div className="workflow-container">
            <nav className="workflow-nav" aria-label="Workflow steps">
                {steps.map((step, index) => (
                    <React.Fragment key={step.id}>
                        <button
                            type="button"
                            className={`workflow-step ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'completed' : ''}`}
                            onClick={() => navigate(step.path)}
                            aria-current={index === currentIndex ? 'step' : undefined}
                        >
                            <span className="workflow-dot-container" aria-hidden="true">
                                <span className={`workflow-dot ${index === currentIndex ? 'active' : ''}`} />
                            </span>
                            <span className="workflow-step-text">{step.label}</span>
                        </button>                        {index < steps.length - 1 && (
                            <ChevronRight size={14} className="workflow-separator" aria-hidden="true" />
                        )}
                    </React.Fragment>
                ))}
            </nav>

            <div className="workflow-actions">
                <button
                    type="button"
                    onClick={handleBack}
                    disabled={currentIndex === 0}
                    className="btn btn-outline"
                >
                    <ChevronLeft size={16} aria-hidden="true" />
                    Back
                </button>

                <span className="workflow-progress">
                    Step {currentIndex + 1} of {steps.length}: {steps[currentIndex].label}
                </span>

                <button
                    type="button"
                    onClick={handleNext}
                    disabled={currentIndex === steps.length - 1}
                    className="btn btn-primary"
                >
                    Next
                    <ArrowRight size={16} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
};

export default WorkflowHeader;
