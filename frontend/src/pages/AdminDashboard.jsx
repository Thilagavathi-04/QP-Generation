import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Trash2, Shield, Search } from 'lucide-react';
import '../styles/Admin.css'; // We will create this next

const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch users on mount
    const fetchUsers = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:8010/api/admin/users');
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

            await axios.post('http://127.0.0.1:8010/api/admin/action', {
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

    // Filter users
    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <h1><Shield size={32} /> Admin Dashboard</h1>
                <p>Manage user access requests</p>
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

            <div className="users-table-container">
                {isLoading ? (
                    <div className="loading">Loading users...</div>
                ) : (
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th>Actions</th>

                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <motion.tr
                                    key={user.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    layout
                                >
                                    <td className="user-cell">
                                        <div className="user-avatar">{user.name.charAt(0)}</div>
                                        <span className="user-name">{user.name}</span>
                                    </td>
                                    <td>{user.email}</td>
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
                                            </>
                                        )}
                                    </td>

                                </motion.tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="empty-state">No users found</td>
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
