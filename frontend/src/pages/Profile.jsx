import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { User, Mail, Shield, Book, Lock, RefreshCcw, Camera } from 'lucide-react';
import { showToast } from '../components/Toast';

export default function Profile() {
  const { user, userData, isAdmin } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return showToast("Passwords do not match", "error");
    }
    if (newPassword.length < 8) {
      return showToast("Password must be at least 8 characters", "error");
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updatePassword(currentUser, newPassword);
        
        // Update mustChangePassword flag in Firestore if it exists
        if (userData?.mustChangePassword) {
          await updateDoc(doc(db, "users", user.uid), {
            mustChangePassword: false
          });
        }
        
        showToast("Password updated successfully!", "success");
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      console.error(error);
      showToast(error.message || "Failed to update password. You may need to log out and log back in to perform this action.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!userData) return <div className="flex items-center justify-center h-screen"><div className="spinner"></div></div>;

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{
        background: 'var(--gradient-banner)',
        padding: '3rem 2rem',
        borderRadius: '24px',
        marginBottom: '2rem',
        color: 'white',
        boxShadow: 'var(--shadow-rose)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '200px',
          height: '200px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '50%',
          filter: 'blur(30px)'
        }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '4px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
            position: 'relative'
          }}>
            <User size={64} style={{ color: 'var(--primary-500)' }} />
            <button style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              background: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              color: 'var(--primary-600)',
              cursor: 'pointer'
            }}>
              <Camera size={16} />
            </button>
          </div>
          
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0, color: 'white' }}>{userData.Name}</h1>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <span style={{ 
                background: 'rgba(255,255,255,0.2)', 
                padding: '4px 12px', 
                borderRadius: '12px', 
                fontSize: '0.875rem', 
                fontWeight: '600',
                backdropFilter: 'blur(5px)'
              }}>
                {userData.role.toUpperCase()}
              </span>
              <span style={{ 
                background: 'rgba(255,255,255,0.2)', 
                padding: '4px 12px', 
                borderRadius: '12px', 
                fontSize: '0.875rem', 
                fontWeight: '600',
                backdropFilter: 'blur(5px)'
              }}>
                {userData.Dept || 'Admin'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.5fr', gap: '2rem' }}>
        {/* INFO COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary-700)', marginBottom: '1.5rem' }}>
              <Shield size={20} /> Account Information
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-500)' }}>
                  <Mail size={18} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--secondary-400)', fontWeight: '700', textTransform: 'uppercase' }}>Email Address</p>
                  <p style={{ margin: 0, fontWeight: '600', color: 'var(--secondary-800)' }}>{userData.email}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-500)' }}>
                  <Shield size={18} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--secondary-400)', fontWeight: '700', textTransform: 'uppercase' }}>Security Level</p>
                  <p style={{ margin: 0, fontWeight: '600', color: 'var(--secondary-800)' }}>{isAdmin ? 'Full Administrator Access' : 'Standard Faculty Access'}</p>
                </div>
              </div>
            </div>
          </div>

          {!isAdmin && userData.courses && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary-700)', marginBottom: '1.5rem' }}>
                <Book size={20} /> Assigned Courses
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {userData.courses.map((course, i) => (
                  <div key={i} style={{ 
                    padding: '0.75rem', 
                    borderRadius: '12px', 
                    background: 'var(--primary-50)', 
                    border: '1px solid var(--primary-100)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <div style={{ background: 'white', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary-700)' }}>
                      REG {course.regulation}
                    </div>
                    <span style={{ fontWeight: '600', color: 'var(--secondary-800)' }}>{course.subject}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SECURITY COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary-700)', marginBottom: '1rem' }}>
              <Lock size={20} /> Security & Password
            </h3>
            
            {userData.mustChangePassword && (
              <div style={{ 
                padding: '1rem', 
                background: '#fff7ed', 
                border: '1px solid #ffedd5', 
                borderRadius: '12px', 
                marginBottom: '1.5rem',
                color: '#9a3412',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center'
              }}>
                <RefreshCcw size={20} className="spin-slow" />
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>
                  <strong>First Login Required:</strong> Please change your password from the default '12345678' to secure your account.
                </p>
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">New Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  autoComplete="new-password"
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                  minLength={8}
                  placeholder="Enter at least 8 characters"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Confirm New Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  autoComplete="new-password"
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required 
                  minLength={8}
                  placeholder="Repeat new password"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading} 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.75rem' }}
              >
                {loading ? 'Processing...' : 'Update Security Credentials'}
              </button>
            </form>
          </div>
          
          <div style={{ 
            padding: '1.5rem', 
            borderRadius: '20px', 
            background: 'var(--secondary-50)', 
            border: '1px dashed var(--secondary-200)',
            color: 'var(--secondary-500)',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0 }}>System Version 2.4.0 • Built for Sri Shakthi Institute of Engineering & Technology</p>
          </div>
        </div>
      </div>
    </div>
  );
}
