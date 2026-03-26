import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    Home,
    BookOpen,
    FileText,
    Database,
    Layout,
    FileOutput,
    Archive,
    LogOut,
    Shield,
    ClipboardList,
    ChevronRight
} from 'lucide-react'

const Sidebar = () => {
    const location = useLocation()

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/'
        return location.pathname.startsWith(path)
    }

    const navGroups = [
        {
            title: 'dashboard',
            items: [
                { path: '/', label: 'Overview', icon: Home },
            ]
        },
        {
            title: 'Course Content',
            items: [
                { path: '/subjects', label: 'Subjects', icon: BookOpen },
                { path: '/question-bank', label: 'Question Bank', icon: Database },
            ]
        },
        {
            title: 'Assessment',
            items: [
                { path: '/blueprints', label: 'Blueprints', icon: Layout },
                { path: '/generate-paper', label: 'Generate Paper', icon: FileOutput },
                { path: '/generated-papers', label: 'Paper History', icon: Archive },
            ]
        },
        {
            title: 'Evaluation',
            items: [
                { path: '/grading-dashboard', label: 'Grading', icon: ClipboardList }
            ]
        }
    ]

    // Add Admin Panel if Admin
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    if (userData.role === 'admin') {
        navGroups.push({
            title: 'System',
            items: [{ path: '/admin', label: 'Admin Panel', icon: Shield }]
        });
    }

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <Link to="/" className="sidebar-logo">
                    <div className="logo-icon">QG</div>
                    <span>Quest Generator</span>
                </Link>
            </div>

            <div className="sidebar-nav">
                {navGroups.map((group, groupIdx) => (
                    <div key={groupIdx} className="sidebar-group">
                        <h3 className="sidebar-group-title">{group.title}</h3>
                        {group.items.map(({ path, label, icon: Icon }) => (
                            <Link
                                key={path}
                                to={path}
                                className={`sidebar-link ${isActive(path) ? 'active' : ''}`}
                            >
                                <Icon size={18} />
                                <span>{label}</span>
                                {isActive(path) && <ChevronRight size={14} className="active-indicator" />}
                            </Link>
                        ))}
                    </div>
                ))}
            </div>

            <div className="sidebar-footer">
                <button
                    onClick={() => {
                        localStorage.removeItem('isAuthenticated');
                        localStorage.removeItem('user');
                        window.location.reload();
                    }}
                    className="logout-btn"
                >
                    <LogOut size={18} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    )
}

export default Sidebar