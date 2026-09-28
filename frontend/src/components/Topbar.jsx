import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { getPageTitle, getNavLabel } from '../utils/pageMeta'

const Topbar = ({ open, onToggle }) => {
    const location = useLocation()
    const { userData } = useAuth()

    useEffect(() => {
        document.title = getPageTitle(location.pathname)
    }, [location.pathname])

    const name = userData?.name || userData?.Name || 'User'

    return (
        <header className="topbar">
            <button
                id="nav-toggle"
                type="button"
                className="topbar-menu"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls="sidebar"
                aria-label={open ? 'Close navigation' : 'Open navigation'}
            >
                {open ? <X size={20} /> : <Menu size={20} />}
            </button>

            <span className="topbar-title">{getNavLabel(location.pathname)}</span>

            <Link to="/profile" className="topbar-user">
                <span className="topbar-avatar" aria-hidden="true">
                    {name.charAt(0).toUpperCase()}
                </span>
                <span className="topbar-user-name">{name}</span>
            </Link>
        </header>
    )
}

export default Topbar
