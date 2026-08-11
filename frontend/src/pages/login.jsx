import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { showToast } from '../utils/toast';

const API_BASE = 'http://127.0.0.1:8010';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      showToast('Email and password are required.', 'warning');
      return;
    }
                                                                                                                                                                                                                                                                                                                                                                                                                                      
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.detail || 'Login failed. Please try again.', 'error');
        return;
      }

      // Persist session in AuthContext + localStorage
      setSession(data.user, data.token);
      showToast('Successfully logged in!', 'success');

      if (data.user.must_change_password) {
        navigate('/profile');
        showToast('First login detected. Please update your password.', 'info');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error. Please check if the server is running.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--gradient-banner)' }}>
      <div className="card fade-in" style={{ width: '410px', padding: '3rem', background: 'white', borderRadius: '24px', boxShadow: 'var(--card-shadow-hover)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'var(--primary-600)',
            borderRadius: '16px',
            color: 'white',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 8px 16px rgba(119, 137, 107, 0.25)'
          }}>QG</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--secondary-900)', margin: 0 }}>Secure Portal</h2>
          <p style={{ color: 'var(--secondary-500)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Login to your Quest Generator account</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.025em', color: 'var(--secondary-600)' }}>Email Address</label>
            <input
              id="login-email"
              type="email"
              required
              className="form-input"
              placeholder="faculty@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '0.875rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2.5rem' }}>
            <label className="form-label" style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.025em', color: 'var(--secondary-600)' }}>Password</label>
            <input
              id="login-password"
              type="password"
              required
              className="form-input"
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '0.875rem' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            id="login-submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', fontWeight: '800', justifyContent: 'center', boxShadow: '0 4px 12px rgba(119, 137, 107, 0.2)' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
