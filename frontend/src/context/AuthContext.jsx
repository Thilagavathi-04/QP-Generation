import React, { useEffect, useState, useCallback } from 'react';
import { AuthContext } from './AuthContextObject';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // { id, email, name, role, department, must_change_password }
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  const restoreSession = useCallback(async () => {
    const token = localStorage.getItem('qp_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/me?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const user = await res.json();
        setCurrentUser({ ...user, token });
      } else {
        // Token invalid / expired — clear it
        localStorage.removeItem('qp_token');
      }
    } catch {
      localStorage.removeItem('qp_token');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const logout = useCallback(() => {
    localStorage.removeItem('qp_token');
    setCurrentUser(null);
  }, []);

  // Called by login.jsx after successful POST /api/auth/login
  const setSession = useCallback((userData, token) => {
    localStorage.setItem('qp_token', token);
    setCurrentUser({ ...userData, token });
  }, []);

  const role = currentUser?.role;
  const value = {
    currentUser,
    user: currentUser,
    userData: currentUser,          // backward-compat alias used by Profile.jsx etc.
    isAdmin: role === 'admin',
    isHod: role === 'hod',
    isStaff: role === 'staff' || role === 'advisor',
    isAdvisor: role === 'advisor' || role === 'staff', // legacy alias
    token: currentUser?.token || null,
    logout,
    setSession,
    refreshUser: restoreSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
