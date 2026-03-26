import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from 'firebase/auth';
import axios from 'axios';
import '../styles/Auth.css';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  // CLEAR STORAGE ON MOUNT TO PREVENT FALSE POSITIVES
  React.useEffect(() => {
    localStorage.removeItem('isAuthenticated');
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    console.log(`Attempting ${isLogin ? 'Login' : 'Signup'} for ${formData.email}`);

    try {
      if (isLogin) {
        // Login Flow
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        // CHECK IF EMAIL IS VERIFIED
        if (!user.emailVerified && user.email.toLowerCase() !== "gsrinath222@gmail.com") {
          await signOut(auth); // Force logout
          throw { code: 'auth/email-not-verified', message: 'Please check your inbox and verify your email first.' };
        }

        // Persist session only if verified AND approved by admin
        // FIRST: Sync with Backend DB to check status
        const syncRes = await axios.post('http://127.0.0.1:8010/api/auth/sync-user', {
          email: user.email,
          name: user.displayName || 'User'
        });

        const { status, role } = syncRes.data;

        if (status === 'pending') {
          await signOut(auth);
          throw { code: 'auth/account-pending', message: 'Your account is waiting for Admin Approval.' };
        }

        if (status === 'rejected') {
          await signOut(auth);
          throw { code: 'auth/account-rejected', message: 'Your account was rejected by the Admin.' };
        }

        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify({
          uid: user.uid,
          email: user.email,
          name: user.displayName || 'User',
          role: role // Save role (admin/user)
        }));

        if (role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
        window.location.reload();
      } else {
        // Signup Flow
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        // Update profile
        await updateProfile(user, { displayName: formData.name });


        // Sync with backend to create 'pending' record immediately
        await axios.post('http://127.0.0.1:8010/api/auth/sync-user', {
          email: user.email,
          name: formData.name
        });

        // SEND VERIFICATION EMAIL
        await sendEmailVerification(user);

        // FORCE LOGOUT (Do not let them in yet)
        await signOut(auth);

        setSuccessMsg(`Account created! A verification link has been sent to ${formData.email}. Wait for Admin Approval.`);

        // Switch to login mode automatically so they can log in after verifying
        setTimeout(() => {
          setIsLogin(true);
        }, 5000);
      }
    } catch (err) {
      console.error(err);

      // Handle custom errors directly
      if (['auth/email-not-verified', 'auth/account-pending', 'auth/account-rejected'].includes(err.code)) {
        setError(err.message);
        return;
      }

      let msg = 'Authentication failed.';
      if (err.code === 'auth/invalid-email') msg = 'Invalid email address.';
      if (err.code === 'auth/user-disabled') msg = 'User account is disabled.';
      if (err.code === 'auth/user-not-found') msg = 'No account found with this email.';
      if (err.code === 'auth/wrong-password') msg = 'Incorrect password.';
      if (err.code === 'auth/email-already-in-use') msg = 'Email is already registered.';
      if (err.code === 'auth/weak-password') msg = 'Password should be at least 6 characters.';

      setError(msg + ` (${err.code || err.message})`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccessMsg('');
    setFormData({ name: '', email: '', password: '' });
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
        <div className="circle circle-3"></div>
      </div>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="auth-header">
          <motion.h1
            key={isLogin ? "login" : "signup"}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </motion.h1>
          <p className="auth-subtitle">
            {isLogin
              ? 'Enter your credentials to access the Quest Generator'
              : 'Join us to start generating question papers'}
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="auth-error-message"
          >
            {error}
          </motion.div>
        )}

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="auth-success-message"
          >
            <CheckCircle2 size={16} /> {successMsg}
          </motion.div>
        )}

        <form onSubmit={handleAuth} className="auth-form">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="form-group"
              >
                <div className="input-icon-wrapper">
                  <User className="input-icon" size={20} />
                  <input
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={handleChange}
                    required={!isLogin}
                    className="auth-input"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="form-group">
            <div className="input-icon-wrapper">
              <Mail className="input-icon" size={20} />
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
                className="auth-input"
              />
            </div>
          </div>

          <div className="form-group">
            <div className="input-icon-wrapper">
              <Lock className="input-icon" size={20} />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                className="auth-input"
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`auth-submit-btn ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
            style={{ backgroundColor: isLogin ? '#4CAF50' : '#2196F3' }} // Green for Login, Blue for Signup
          >
            {isLoading ? (
              <Loader2 className="spinner" size={20} />
            ) : (
              <>
                {isLogin ? 'Sign In (Existing User)' : 'Sign Up (New Account)'}
                <ArrowRight size={20} className="btn-icon" />
              </>
            )}
          </motion.button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              className="toggle-auth"
              onClick={toggleAuthMode}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
