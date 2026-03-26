import React, { useState, useEffect } from 'react';
import { FileText, ClipboardList, CheckCircle, Upload, Eye, FilePieChart, RefreshCw, Database, X, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { showToast } from '../components/Toast';
import Modal from '../components/Modal';

const CustomModal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }} onClick={onClose}>
            <div style={{
                background: 'white', borderRadius: '20px', width: '90%', maxWidth: '600px',
                maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-rose)',
                position: 'relative', animation: 'slideUp 0.3s ease-out'
            }} onClick={e => e.stopPropagation()}>
                <div style={{
                    padding: '1.5rem', borderBottom: '1px solid var(--secondary-100)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <h3 style={{ margin: 0, color: 'var(--secondary-900)' }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary-400)' }}>
                        <X size={24} />
                    </button>
                </div>
                <div style={{ padding: '1.5rem' }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

const GradingDashboard = () => {

    const [papers, setPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [evaluating, setEvaluating] = useState(false);
    const [generatingScript, setGeneratingScript] = useState(null);
    const [modalState, setModalState] = useState({
        isOpen: false,
        type: '',
        title: '',
        paperId: null,
        paperTitle: ''
    });
    const [formData, setFormData] = useState({
        student_name: '',
        register_number: '',
        department: '',
        student_file: null
    });

    const [selectedScript, setSelectedScript] = useState(null);
    const [isSavingScript, setIsSavingScript] = useState(false);

    useEffect(() => {
        fetchPapers();
    }, []);

    const fetchPapers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/question-papers');
            setPapers(response.data);
        } catch (error) {
            console.error('Error fetching papers:', error);
            showToast('Failed to load question papers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateScript = async (paperId) => {
        try {
            setGeneratingScript(paperId);
            showToast('Generating AI Answer Script... This may take a minute.', 'info');
            const response = await api.post(`/api/answer-scripts/generate/${paperId}`);
            if (response.data.success) {
                showToast('Answer script generated successfully!', 'success');
                await fetchPapers();
                // After generation, open preview/edit
                handleViewScript(paperId);
            }
        } catch (error) {
            console.error('Error generating script:', error);
            showToast(error.message || 'Failed to generate answer script', 'error');
        } finally {
            setGeneratingScript(null);
        }
    };

    const handleViewScript = async (paperId) => {
        try {
            setLoading(true);
            const response = await api.get(`/api/answer-scripts/${paperId}`);

            let parsedAnswers = [];
            try {
                const data = response.data.answer_data;
                parsedAnswers = typeof data === 'string' ? JSON.parse(data) : data;

                // If it's an object with an 'answers' key, extract it
                if (parsedAnswers && !Array.isArray(parsedAnswers) && parsedAnswers.answers) {
                    parsedAnswers = parsedAnswers.answers;
                }

                // Ensure it's an array for .map()
                if (!Array.isArray(parsedAnswers)) {
                    parsedAnswers = [];
                }
            } catch (err) {
                console.error('Json parse error:', err);
                parsedAnswers = [];
            }

            setSelectedScript({
                paperId,
                answers: parsedAnswers
            });
            setModalState({
                isOpen: true,
                type: 'editScript',
                title: 'Review & Edit AI Answer Script',
                paperId: paperId
            });
        } catch (error) {
            console.error('Error fetching script:', error);
            showToast('Failed to load script details', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveScript = async () => {
        if (!selectedScript || !selectedScript.answers) {
            showToast('No script data to save', 'error');
            return;
        }

        try {
            setIsSavingScript(true);
            console.log('Saving script for paper:', selectedScript.paperId, 'with answers:', selectedScript.answers);
            const response = await api.put(`/api/answer-scripts/${selectedScript.paperId}`, {
                answer_data: selectedScript.answers
            });
            if (response.data.success) {
                showToast('Answer script updated successfully', 'success');
                setModalState({ ...modalState, isOpen: false });
                fetchPapers(); // Refresh papers to show updated status
            }
        } catch (error) {
            console.error('Error saving script:', error);
            showToast(error.message || 'Failed to save script edits', 'error');
        } finally {
            setIsSavingScript(false);
        }
    };

    const handleAnswerChange = (index, field, value) => {
        const newAnswers = [...selectedScript.answers];
        newAnswers[index] = { ...newAnswers[index], [field]: value };
        setSelectedScript({ ...selectedScript, answers: newAnswers });
    };

    const handleDownloadScript = async (paperId, paperTitle) => {
        try {
            const response = await api.get(`/api/answer-scripts/${paperId}`);
            let data = response.data.answer_data;
            let answers = typeof data === 'string' ? JSON.parse(data) : data;

            if (answers && !Array.isArray(answers) && answers.answers) {
                answers = answers.answers;
            }

            if (!Array.isArray(answers)) {
                showToast('Answer script is empty or invalid', 'warning');
                return;
            }

            // Generate TXT content
            let content = `OFFICIAL ANSWER KEY: ${paperTitle}\n`;
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
            a.download = `Answer_Key_${paperTitle.replace(/\s+/g, '_')}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('Answer script downloaded successfully!', 'success');
        } catch (error) {
            console.error('Error downloading script:', error);
            showToast('Failed to download answer script', 'error');
        }
    };

    const openEvaluateModal = (paper) => {
        setModalState({
            isOpen: true,
            type: 'evaluate',
            title: `Evaluate for: ${paper.title}`,
            paperId: paper.id,
            paperTitle: paper.title
        });
    };

    const handleFileChange = (e) => {
        setFormData({ ...formData, student_file: e.target.files[0] });
    };

    const handleEvaluateSubmit = async (e) => {
        e.preventDefault();
        if (!formData.student_file) {
            showToast('Please upload a student paper PDF', 'warning');
            return;
        }

        const submitData = new FormData();
        submitData.append('paper_id', modalState.paperId);
        submitData.append('student_name', formData.student_name);
        submitData.append('register_number', formData.register_number);
        submitData.append('department', formData.department);
        submitData.append('student_file', formData.student_file);

        try {
            setEvaluating(true);
            showToast('AI is evaluating the student paper... Please wait.', 'info');
            const response = await api.post('/api/evaluations/evaluate', submitData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                showToast(`Evaluation Complete! Result: ${response.data.result}, Marks: ${response.data.marks}`, 'success');
                setModalState({ ...modalState, isOpen: false });
                setFormData({
                    student_name: '',
                    register_number: '',
                    department: '',
                    student_file: null
                });
            }
        } catch (error) {
            console.error('Evaluation error:', error);
            showToast(error.message || 'Evaluation failed. Make sure Answer Script is generated first.', 'error');
        } finally {
            setEvaluating(false);
        }
    };

    return (
        <div style={{ padding: '2rem', width: '100%' }}>
            <div style={{
                background: 'var(--gradient-banner)',
                padding: '2.5rem',
                borderRadius: '24px',
                marginBottom: '2rem',
                boxShadow: 'var(--shadow-rose)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h1 style={{ fontSize: '2 rem', fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', color: 'white', gap: '1rem' }}>
                        AI Grading & Evaluation
                    </h1>
                    <p style={{ opacity: 0.9, fontSize: '1.1rem', maxWidth: '800px' }}>
                        Generate AI-powered answer scripts and automatically evaluate student submissions.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner"></div></div>
                ) : papers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--primary-50)', borderRadius: '16px' }}>
                        <FileText size={48} style={{ color: 'var(--primary-300)', marginBottom: '1rem' }} />
                        <h3 style={{ color: 'var(--primary-700)' }}>No question papers found</h3>
                        <p style={{ color: 'var(--secondary-500)' }}>Go to Generate Question Paper to create your first exam paper.</p>
                        <Link to="/generate-paper" className="btn btn-primary" style={{ marginTop: '1rem' }}>Generate Paper</Link>
                    </div>
                ) : (
                    papers.map((paper) => (
                        <div key={paper.id} style={{
                            background: 'white',
                            borderRadius: '20px',
                            padding: '1.75rem',
                            border: '1px solid var(--primary-100)',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '2rem',
                            flexWrap: 'nowrap' // Force horizontal alignment like Set B
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: '1' }}>
                                <div style={{
                                    padding: '1.1rem',
                                    borderRadius: '14px',
                                    background: 'var(--primary-50)',
                                    color: 'var(--primary-600)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)'
                                }}>
                                    <FileText size={30} />
                                </div>
                                <div style={{ flex: '1' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                        <h3 style={{ margin: 0, color: 'var(--secondary-900)', fontSize: '1.3rem', fontWeight: '700' }}>{paper.title}</h3>
                                        {paper.has_answer_script && (
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                color: 'var(--success-600)',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                background: 'var(--success-100)',
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '999px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.025em'
                                            }}>
                                                <CheckCircle size={14} /> Ready
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                        <span style={{ color: 'var(--secondary-500)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            Subject ID: <strong>{paper.subject_id}</strong>
                                        </span>
                                        <span style={{ color: 'var(--secondary-500)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            Marks: <strong>{paper.total_marks}</strong>
                                        </span>
                                        <span style={{
                                            color: 'var(--primary-600)',
                                            fontWeight: '700',
                                            padding: '0 0.5rem',
                                            borderRadius: '4px',
                                            background: 'var(--primary-50)',
                                            fontSize: '0.8rem'
                                        }}>{paper.exam_type}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => handleGenerateScript(paper.id)}
                                    disabled={generatingScript === paper.id}
                                    className="btn btn-outline"
                                    style={{
                                        padding: '0.6rem 1rem',
                                        fontSize: '0.85rem',
                                        minWidth: '150px'
                                    }}
                                >
                                    {generatingScript === paper.id ? <RefreshCw className="animate-spin" size={16} /> : <Database size={16} />}
                                    {generatingScript === paper.id ? 'Generating...' : (paper.has_answer_script ? 'Regenerate' : 'Generate Script')}
                                </button>

                                {paper.has_answer_script && (
                                    <>
                                        <button
                                            onClick={() => handleViewScript(paper.id)}
                                            className="btn btn-outline"
                                            style={{
                                                padding: '0.6rem 1rem',
                                                fontSize: '0.85rem',
                                                background: 'white'
                                            }}
                                        >
                                            <Eye size={16} /> View/Edit
                                        </button>
                                        <button
                                            onClick={() => handleDownloadScript(paper.id, paper.title)}
                                            className="btn btn-outline"
                                            style={{
                                                padding: '0.6rem',
                                                minWidth: 'auto',
                                                background: 'var(--secondary-50)'
                                            }}
                                            title="Download Answer Script"
                                        >
                                            <Download size={16} />
                                        </button>
                                    </>
                                )}

                                <button
                                    onClick={() => openEvaluateModal(paper)}
                                    className="btn btn-primary"
                                    style={{
                                        padding: '0.6rem 1.1rem',
                                        fontSize: '0.85rem',
                                        background: 'var(--gradient-sage-contrast)'
                                    }}
                                >
                                    <Upload size={16} /> Evaluate
                                </button>

                                <Link
                                    to={`/evaluation-results/${paper.id}`}
                                    className="btn btn-secondary"
                                    style={{
                                        padding: '0.6rem 1.1rem',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    <FilePieChart size={16} /> Results
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {modalState.isOpen && (
                <CustomModal
                    isOpen={modalState.isOpen}
                    onClose={() => setModalState({ ...modalState, isOpen: false })}
                    title={modalState.title}
                >
                    {modalState.type === 'editScript' && selectedScript ? (
                        <div>
                            <p style={{ marginBottom: '1.5rem', color: 'var(--secondary-600)', fontSize: '0.9rem' }}>
                                Review the AI-generated answers. You can edit them to ensure accuracy before evaluation.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                                {selectedScript.answers.map((item, idx) => (
                                    <div key={idx} style={{ padding: '1rem', border: '1px solid var(--secondary-100)', borderRadius: '12px', background: 'var(--secondary-50)' }}>
                                        <div style={{ marginBottom: '0.75rem' }}>
                                            <label style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--secondary-500)', display: 'block', marginBottom: '0.25rem' }}>QUESTION {idx + 1} ({item.marks} Marks)</label>
                                            <div style={{ fontWeight: '600', color: 'var(--secondary-900)' }}>{item.question}</div>
                                        </div>
                                        <div style={{ marginBottom: '0.75rem' }}>
                                            <label style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--secondary-500)', display: 'block', marginBottom: '0.25rem' }}>MODEL ANSWER</label>
                                            <textarea
                                                className="form-input"
                                                style={{ minHeight: '80px', fontSize: '0.9rem' }}
                                                value={item.answer}
                                                onChange={(e) => handleAnswerChange(idx, 'answer', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--secondary-500)', display: 'block', marginBottom: '0.25rem' }}>EXPECTED POINTS / KEYWORDS</label>
                                            <input
                                                className="form-input"
                                                style={{ fontSize: '0.9rem' }}
                                                value={item.expected_points || ''}
                                                onChange={(e) => handleAnswerChange(idx, 'expected_points', e.target.value)}
                                                placeholder="Key points AI should look for..."
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', position: 'sticky', bottom: 0, background: 'white', padding: '1rem 0', borderTop: '1px solid var(--secondary-100)' }}>
                                <button
                                    className="btn btn-secondary"
                                    style={{ flex: 1 }}
                                    onClick={() => setModalState({ ...modalState, isOpen: false })}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 2, background: 'var(--gradient-sage-contrast)' }}
                                    onClick={handleSaveScript}
                                    disabled={isSavingScript}
                                >
                                    {isSavingScript ? 'Saving...' : 'Save Answer Script'}
                                </button>
                            </div>
                        </div>
                    ) : modalState.type === 'evaluate' ? (
                        <form onSubmit={handleEvaluateSubmit}>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label">Student Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    required
                                    value={formData.student_name}
                                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                                    placeholder="Enter student's full name"
                                />
                            </div>
                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Register Number</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        value={formData.register_number}
                                        onChange={(e) => setFormData({ ...formData, register_number: e.target.value })}
                                        placeholder="20XX..."
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Department</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        placeholder="e.g. CSE"
                                    />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label className="form-label">Student Answer Script (PDF)</label>
                                <div style={{
                                    border: '2px dashed var(--primary-200)',
                                    padding: '2rem',
                                    borderRadius: '12px',
                                    textAlign: 'center',
                                    background: 'var(--primary-50)',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}>
                                    <Upload size={32} style={{ color: 'var(--primary-400)', marginBottom: '0.5rem' }} />
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--secondary-600)' }}>
                                        {formData.student_file ? formData.student_file.name : 'Click to select student paper PDF'}
                                    </p>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={handleFileChange}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            opacity: 0,
                                            cursor: 'pointer'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ flex: 1 }}
                                    onClick={() => setModalState({ ...modalState, isOpen: false })}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ flex: 2, background: 'var(--gradient-pastel-primary)' }}
                                    disabled={evaluating}
                                >
                                    {evaluating ? 'AI Evaluating...' : 'Submit for Evaluation'}
                                </button>
                            </div>
                        </form>
                    ) : null}
                </CustomModal>
            )}
        </div>
    );
};

export default GradingDashboard;
