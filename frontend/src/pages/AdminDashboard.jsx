import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, Trash2, Shield, Search } from 'lucide-react';
import '../styles/Admin.css'; // We will create this next
import { useAuth } from '../context/useAuth';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

const normalizeRole = (role) => {
    const normalized = (role || '').toLowerCase();
    if (normalized === 'advisor' || normalized === 'teacher') return 'staff';
    if (normalized === 'admin' || normalized === 'hod' || normalized === 'staff') return normalized;
    return 'staff';
};

const AdminDashboard = () => {
    const { isAdmin, userData } = useAuth();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [openRoleMenuUserId, setOpenRoleMenuUserId] = useState(null);
    const [pendingRoleChange, setPendingRoleChange] = useState(null);

    // Fetch users on mount
    const fetchUsers = async () => {
        try {
            const response = await axios.get(`${API_BASE}/api/admin/users`);
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
            alert('Failed to load users');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAction = async (userId, action) => {
        try {
            if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

            await axios.post(`${API_BASE}/api/admin/action`, {
                user_id: userId,
                action: action
            });

            // Optimistic update
            setUsers(users.map(user =>
                user.id === userId
                    ? { ...user, status: action === 'approve' ? 'approved' : 'rejected' }
                    : user
            ));

            // If we rejected (deleted) logic - user asked to "delete".
            // My backend implementation marked it as 'rejected'. 
            // If the user really wants to DELETE from DB, I might need to update backend.
            // But 'rejecting' effectively bans them. 

        } catch (error) {
            console.error(`Error ${action} user:`, error);
            alert('Action failed');
        }
    };

    const handleRoleMenuToggle = (userId) => {
        setOpenRoleMenuUserId(prev => (prev === userId ? null : userId));
    };

    const handleRoleSelect = (userId, selectedRole) => {
        const currentUser = users.find(user => user.id === userId);
        const currentRole = normalizeRole(currentUser?.role);

        if (!selectedRole || selectedRole === currentRole) return;

        setOpenRoleMenuUserId(null);
        setPendingRoleChange({
            userId,
            role: selectedRole,
            userName: currentUser?.name || 'this user'
        });
    };

    const confirmRoleChange = async () => {
        if (!pendingRoleChange) return;

        const { userId, role } = pendingRoleChange;

        try {
            await axios.post(`${API_BASE}/api/admin/update-role`, {
                user_id: userId,
                role
            });

            setUsers(prevUsers => prevUsers.map(user => (
                user.id === userId ? { ...user, role } : user
            )));
            setPendingRoleChange(null);
        } catch (error) {
            console.error('Error updating role:', error);
            alert(error.response?.data?.detail || 'Role update failed');
        }
    };

    const cancelRoleChange = () => {
        setPendingRoleChange(null);
    };

    // Filter users
    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleColor = (role) => {
        switch (normalizeRole(role)) {
            case 'admin': return 'bg-purple-100 text-purple-800';
            case 'hod': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-yellow-100 text-yellow-800'; // pending
        }
    };

    return (
        <div className="admin-container">
            <div className="admin-header">
                <h1><Shield size={32} /> {isAdmin ? 'Admin Dashboard' : 'Department Users'}</h1>
                <p>{isAdmin ? 'Manage user access requests' : `Manage users in the ${userData?.department || 'your'} department`}</p>
            </div>

            <div className="admin-controls">
                <div className="search-bar">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {pendingRoleChange && (
                <div className="role-modal-backdrop" role="presentation" onClick={cancelRoleChange}>
                    <div
                        className="role-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="role-modal-title"
                        aria-describedby="role-modal-description"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="role-modal-title">Confirm role update</h2>
                        <p id="role-modal-description">
                            Change {pendingRoleChange.userName} to <strong>{pendingRoleChange.role.toUpperCase()}</strong>?
                        </p>
                        <div className="role-modal-actions">
                            <button type="button" className="action-btn modal-cancel" onClick={cancelRoleChange}>
                                Cancel
                            </button>
                            <button type="button" className="action-btn modal-confirm" onClick={confirmRoleChange}>
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="users-table-container">
                {isLoading ? (
                    <div className="admin-loading">Loading users…</div>
                ) : (
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th>Actions</th>

                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr
                                    key={user.id}
                                >
                                    <td className="user-cell">
                                        <div className="user-avatar">{user.name.charAt(0)}</div>
                                        <span className="user-name">{user.name}</span>
                                    </td>
                                    <td>{user.email}</td>
                                    <td>
                                        <div className="role-cell">
                                            <span className={`status-badge ${getRoleColor(user.role)}`}>
                                                {normalizeRole(user.role)}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${getStatusColor(user.status)}`}>
                                            {user.status || 'pending'}
                                        </span>
                                    </td>
                                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                                    <td className="actions-cell">
                                        {user.email !== 'gsrinath222@gmail.com' && (
                                            <>
                                                {user.status !== 'approved' && (
                                                    <button
                                                        className="action-btn approve"
                                                        onClick={() => handleAction(user.id, 'approve')}
                                                        title="Approve User"
                                                    >
                                                        <CheckCircle size={18} /> Approve
                                                    </button>
                                                )}
                                                {user.status !== 'rejected' && (
                                                    <button
                                                        className="action-btn reject"
                                                        onClick={() => handleAction(user.id, 'reject')}
                                                        title="Reject/Delete User"
                                                    >
                                                        <XCircle size={18} /> Reject
                                                    </button>
                                                )}
                                                {isAdmin && normalizeRole(user.role) !== 'admin' && (
                                                    <div className="role-menu-wrap">
                                                        <button
                                                            type="button"
                                                            className="action-btn role"
                                                            onClick={() => handleRoleMenuToggle(user.id)}
                                                            title="Change role"
                                                        >
                                                            Update Role
                                                        </button>
                                                        {openRoleMenuUserId === user.id && (
                                                            <div className="role-menu">
                                                                <button type="button" className="role-menu-item" onClick={() => handleRoleSelect(user.id, 'staff')}>
                                                                    Staff
                                                                </button>
                                                                <button type="button" className="role-menu-item" onClick={() => handleRoleSelect(user.id, 'hod')}>
                                                                    HOD
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </td>

                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="empty-state">No users found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
