import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, Award, BookOpen, ChevronLeft, Download, FilePieChart, TrendingUp, Users, CheckCircle, XCircle, Eye } from 'lucide-react';
import api from '../utils/api';
import { showToast } from '../utils/toast';

const EvaluationResults = () => {
    const { paperId } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchResults();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paperId]);

    const fetchResults = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/api/evaluations/report/${paperId}`);
            setReport(response.data);
        } catch (error) {
            console.error('Error fetching results:', error);
            showToast('Failed to load evaluation results', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="spinner"></div></div>;
    }

    if (!report || report.total_students === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <Users size={64} style={{ color: 'var(--primary-200)', marginBottom: '1rem' }} />
                <h2>No evaluations found</h2>
                <p>No students have been evaluated for this paper yet.</p>
                <Link to="/grading-dashboard" className="btn btn-primary" style={{ marginTop: '1rem' }}>Go to Grading Dashboard</Link>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link to="/grading-dashboard" style={{ color: 'var(--primary-600)', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={24} /> Back
                </Link>
                <h1 style={{ margin: 0, color: 'var(--secondary-900)' }}>Evaluation Results</h1>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ background: 'var(--gradient-rose-deep)', color: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: 'var(--shadow-rose)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>Total Students</p>
                            <h2 style={{ margin: '0.5rem 0', fontSize: '2rem', color: 'white' }}>{report.total_students}</h2>
                        </div>
                        <Users size={32} style={{ opacity: 0.5 }} />
                    </div>
                </div>

                <div style={{ background: 'var(--gradient-sage-contrast)', color: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 10px 20px rgba(140, 165, 130, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>Pass Percentage</p>
                            <h2 style={{ margin: '0.5rem 0', fontSize: '2rem', color: 'white' }}>{report.pass_percentage.toFixed(1)}%</h2>
                        </div>
                        <CheckCircle size={32} style={{ opacity: 0.5 }} />
                    </div>
                </div>

                <div style={{ background: 'var(--gradient-peach-contrast)', color: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 10px 20px rgba(243, 212, 203, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>Average Marks</p>
                            <h2 style={{ margin: '0.5rem 0', fontSize: '2rem', color: 'white' }}>{report.average_marks.toFixed(1)}</h2>
                        </div>
                        <TrendingUp size={32} style={{ opacity: 0.5 }} />
                    </div>
                </div>

                <div style={{ background: 'var(--gradient-sand-contrast)', color: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 10px 20px rgba(217, 181, 150, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>Fail Count</p>
                            <h2 style={{ margin: '0.5rem 0', fontSize: '2rem', color: 'white' }}>{report.fail_count}</h2>
                        </div>
                        <XCircle size={32} style={{ opacity: 0.5 }} />
                    </div>
                </div>
            </div>

            {/* Results Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2.5rem' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--secondary-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={20} /> Student List
                    </h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--secondary-50)' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--secondary-600)', fontSize: '0.875rem' }}>Student Info</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--secondary-600)', fontSize: '0.875rem' }}>Reg. Number</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--secondary-600)', fontSize: '0.875rem' }}>Department</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--secondary-600)', fontSize: '0.875rem' }}>Marks</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--secondary-600)', fontSize: '0.875rem' }}>Status</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--secondary-600)', fontSize: '0.875rem' }}>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.results.map((res) => (
                                <tr key={res.id} style={{ borderTop: '1px solid var(--secondary-50)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                {res.student_name.charAt(0)}
                                            </div>
                                            <span style={{ fontWeight: '600', color: 'var(--secondary-900)' }}>{res.student_name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', color: 'var(--secondary-700)' }}>{res.register_number}</td>
                                    <td style={{ padding: '1rem', color: 'var(--secondary-700)' }}>{res.department}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: '700', color: res.result_status === 'PASS' ? 'var(--success-600)' : 'var(--danger-600)' }}>
                                            {res.marks_obtained} / {res.total_marks}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            background: res.result_status === 'PASS' ? 'var(--success-100)' : 'var(--danger-100)',
                                            color: res.result_status === 'PASS' ? 'var(--success-700)' : 'var(--danger-700)'
                                        }}>
                                            {res.result_status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <button className="btn btn-icon" title="View Detailed AI Breakdown">
                                            <Eye size={18} style={{ color: 'var(--primary-400)' }} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Official Answer Key Section */}
            {report.answer_script && (
                <div className="card fade-in" style={{ padding: '2rem' }}>
                    <div style={{ borderBottom: '2px solid var(--primary-100)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <BookOpen size={24} style={{ color: 'var(--primary-600)' }} />
                        <h2 style={{ margin: 0, color: 'var(--secondary-900)' }}>Official Answer Key (Model Answers)</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {(() => {
                            let answers = report.answer_script;
                            if (answers && !Array.isArray(answers) && answers.answers) {
                                answers = answers.answers;
                            }
                            if (!Array.isArray(answers)) return <p>No model answers available.</p>;

                            return answers.map((item, idx) => (
                                <div key={idx} style={{ padding: '1.5rem', border: '1px solid var(--secondary-100)', borderRadius: '16px', background: 'var(--secondary-50)' }}>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: '800', color: 'var(--primary-600)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Question {idx + 1}
                                            </span>
                                            <span style={{ padding: '0.25rem 0.75rem', background: 'white', border: '1px solid var(--primary-200)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary-700)' }}>
                                                {item.marks} Marks
                                            </span>
                                        </div>
                                        <div style={{ fontWeight: '700', color: 'var(--secondary-900)', fontSize: '1.1rem', lineHeight: '1.4' }}>
                                            {item.question}
                                        </div>
                                    </div>

                                    <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--secondary-200)', marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', fontWeight: '800', fontSize: '0.75rem', color: 'var(--secondary-400)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Model Answer</label>
                                        <div style={{ color: 'var(--secondary-800)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                            {item.answer}
                                        </div>
                                    </div>

                                    {item.expected_points && (
                                        <div style={{ background: 'var(--primary-50)', padding: '1rem', borderRadius: '12px', border: '1px border-dashed var(--primary-300)' }}>
                                            <label style={{ display: 'block', fontWeight: '800', fontSize: '0.75rem', color: 'var(--primary-600)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Expected Points / Key Keywords</label>
                                            <div style={{ color: 'var(--primary-800)', fontSize: '0.9rem', fontWeight: '500' }}>
                                                {item.expected_points}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EvaluationResults;
