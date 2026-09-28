import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { showToast } from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8010';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setSession } = useAuth();

  useEffect(() => {
    document.title = 'Sign in — QP Generator';
  }, []);

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
        showToast(data.detail || 'Sign in failed. Check your email and password.', 'error');
        return;
      }

      // Persist session in AuthContext + localStorage
      setSession(data.user, data.token);
      showToast('Signed in.', 'success');

      if (data.user.must_change_password) {
        navigate('/profile');
        showToast('First sign in. Please choose a new password.', 'info');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      showToast('Could not reach the server. Check your connection and try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card fade-in">
        <div className="login-brand">
          <div className="login-mark" aria-hidden="true">QP</div>
          <h1 className="login-title">Sign in</h1>
          <p className="login-subtitle">QP Generator</p>
        </div>

        <form onSubmit={handleLogin} noValidate={false}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              className="form-input"
              placeholder="faculty@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              className="form-input"
              value={password}
              placeholder="Your password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            id="login-submit"
            className="btn btn-primary login-submit"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
