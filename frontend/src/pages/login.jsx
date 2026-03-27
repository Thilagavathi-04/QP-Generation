import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../utils/toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const getAuthErrorMessage = (code) => {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password.'
      case 'auth/invalid-email':
        return 'Please enter a valid email address.'
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.'
      case 'auth/user-disabled':
        return 'This account has been disabled.'
      default:
        return 'Login failed. Please try again.'
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPassword = password.trim();

      if (!normalizedEmail || !normalizedPassword) {
        showToast('Email and password are required.', 'warning');
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, normalizedPassword);
      showToast('Successfully logged in!', 'success');
      
      // Check for first login status directly
      const docRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists() && docSnap.data().mustChangePassword) {
        navigate('/profile');
        showToast('First login detected. Please update your password.', 'info');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error(error);
      showToast(getAuthErrorMessage(error.code), 'error');
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
