import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    Home,
    BookOpen,
    Database,
    Layout,
    FileOutput,
    Archive,
    LogOut,
    Shield,
    ClipboardList,
    ChevronRight,
    UserCircle,
    Settings
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const Sidebar = () => {
    const location = useLocation()
    const { userData, logout, isAdmin } = useAuth()

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/'
        return location.pathname.startsWith(path)
    }

    const navGroups = [
        {
            title: 'dashboard',
            items: [
                { path: '/', label: 'Dashboard', icon: Home },
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
                { path: '/generate-paper', label: 'Question paper generation', icon: FileOutput },
                { path: '/generated-papers', label: 'All Question papers', icon: Archive },
            ]
        },
        {
            title: 'Evaluation',
            items: [
                { path: '/grading-dashboard', label: 'Grading', icon: ClipboardList }
            ]
        }
    ]

    // Only show Blueprints to Admins
    if (isAdmin) {
        // Find Assessment group and add Blueprints back or add a new System group
        const assessmentGroup = navGroups.find(g => g.title === 'Assessment');
        if (assessmentGroup) {
            assessmentGroup.items.unshift({ path: '/blueprints', label: 'Blueprints', icon: Layout });
        }

        navGroups.push({
            title: 'System',
            items: [
                { path: '/admin', label: 'Admin Dashboard', icon: Shield },
                { path: '/add-profile', label: 'Manage Faculty', icon: Settings }
            ]
        });
    }

    // Add Profile to everyone
    navGroups.push({
        title: 'Account',
        items: [{ path: '/profile', label: 'My Profile', icon: UserCircle }]
    });

    const handleLogout = async () => {
        try {
            await logout();
            window.location.href = '/login';
        } catch (error) {
            console.error("Logout error", error);
        }
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
                <div style={{ padding: '0 1.5rem 1rem' }}>
                    <div style={{ 
                        padding: '1rem', 
                        background: 'rgba(255,255,255,0.05)', 
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '1rem'
                    }}>
                        <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            background: 'var(--primary-500)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            color: 'white'
                        }}>
                            {userData?.Name?.charAt(0) || 'U'}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userData?.Name || 'User'}</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{userData?.role === 'admin' ? 'Administrator' : 'Faculty'}</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="logout-btn"
                    style={{ width: 'calc(100% - 3rem)', margin: '0 1.5rem 1.5rem' }}
                >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    )
}

export default Sidebar