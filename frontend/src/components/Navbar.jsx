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
    UserCircle,
    Settings,
    Info,
    X
} from 'lucide-react'
import { useAuth } from '../context/useAuth'

const Sidebar = ({ open, onClose }) => {
    const location = useLocation()
    const { userData, logout, isAdmin, isHod } = useAuth()
    const role = userData?.role === 'advisor' ? 'staff' : userData?.role

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/'
        return location.pathname.startsWith(path)
    }

    const navGroups = [
        {
            title: 'Overview',
            items: [
                { path: '/', label: 'Dashboard', icon: Home },
            ]
        },
        {
            title: 'Course content',
            items: [
                { path: '/subjects', label: 'Subjects', icon: BookOpen },
                { path: '/question-bank', label: 'Question bank', icon: Database },
            ]
        },
        {
            title: 'Assessment',
            items: [
                { path: '/generate-paper', label: 'Generate paper', icon: FileOutput },
                { path: '/generated-papers', label: 'All papers', icon: Archive },
            ]
        },
        {
            title: 'Evaluation',
            items: [
                { path: '/grading-dashboard', label: 'Grading', icon: ClipboardList }
            ]
        }
    ]

    // Blueprints: admin only
    if (isAdmin) {
        const assessmentGroup = navGroups.find(g => g.title === 'Assessment')
        if (assessmentGroup) {
            assessmentGroup.items.unshift({ path: '/blueprints', label: 'Blueprints', icon: Layout })
        }
    }

    // System (user management): admin + HOD
    if (isAdmin || isHod) {
        navGroups.push({
            title: 'System',
            items: [
                { path: '/admin', label: isHod ? 'Staff dashboard' : 'Admin dashboard', icon: Shield },
                { path: '/add-profile', label: isAdmin ? 'Manage faculty' : 'Add staff', icon: Settings }
            ]
        })
    }

    navGroups.push({
        title: 'Account',
        items: [{ path: '/profile', label: 'My profile', icon: UserCircle }]
    })

    navGroups.push({
        title: 'About',
        items: [{ path: '/about', label: 'About this app', icon: Info }]
    })

    const roleLabel =
        role === 'admin' ? 'Administrator' :
        role === 'hod' ? 'Head of Department' :
        'Faculty';

    const userName = userData?.name || userData?.Name || 'User'

    const handleLogout = async () => {
        try {
            await logout();
            window.location.href = '/login';
        } catch (error) {
            console.error("Logout error", error);
        }
    }

    return (
        <>
            <div
                className={`sidebar-scrim${open ? ' show' : ''}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <aside id="sidebar" className={`sidebar${open ? ' open' : ''}`}>
                <div className="sidebar-header">
                    <Link to="/" className="sidebar-logo" onClick={onClose}>
                        <img src="/logo.png" alt="" className="sidebar-logo-img" />
                        <span>QP Generator</span>
                    </Link>
                    <button
                        id="nav-close"
                        type="button"
                        className="sidebar-close"
                        onClick={onClose}
                        aria-label="Close navigation"
                    >
                        <X size={18} />
                    </button>
                </div>

                <nav className="sidebar-nav" aria-label="Main navigation">
                    {navGroups.map((group, groupIdx) => (
                        <div key={group.title + groupIdx} className="sidebar-group">
                            <h2 className="sidebar-group-title">{group.title}</h2>
                            {group.items.map((item) => {
                                const NavIcon = item.icon
                                const active = isActive(item.path)
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={onClose}
                                        aria-current={active ? 'page' : undefined}
                                        className={`sidebar-link${active ? ' active' : ''}`}
                                    >
                                        <NavIcon size={18} aria-hidden="true" />
                                        <span>{item.label}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <span className="sidebar-avatar" aria-hidden="true">
                            {userName.charAt(0).toUpperCase()}
                        </span>
                        <span className="sidebar-user-text">
                            <span className="sidebar-user-name">{userName}</span>
                            <span className="sidebar-user-role">{roleLabel}</span>
                        </span>
                    </div>
                    <button type="button" onClick={handleLogout} className="logout-btn">
                        <LogOut size={18} aria-hidden="true" />
                        <span>Sign out</span>
                    </button>
                </div>
            </aside>
        </>
    )
}

export default Sidebar
