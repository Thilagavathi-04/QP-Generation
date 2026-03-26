import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { LogIn, Mail, Lock } from "lucide-react";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        try {
            setLoading(true);
            await signInWithEmailAndPassword(auth, email, password);
            alert("Login successful");
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 30%, #a5f3fc 60%, #e0f2fe 100%)',
            padding: '2rem'
        }}>
            <div className="card fade-in" style={{
                maxWidth: '450px',
                width: '100%',
                background: 'white',
                padding: '2.5rem',
                boxShadow: '0 20px 50px rgba(6, 182, 212, 0.2)',
                border: '1px solid #cffafe'
            }}>
                {/* Header */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: '2rem'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        margin: '0 auto 1.5rem',
                        background: 'linear-gradient(135deg, #a5f3fc 0%, #67e8f9 100%)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 10px 25px rgba(6, 182, 212, 0.3)'
                    }}>
                        <LogIn size={40} style={{ color: 'white' }} />
                    </div>
                    <h2 style={{
                        fontSize: '2rem',
                        fontWeight: '700',
                        color: '#0891b2',
                        marginBottom: '0.5rem'
                    }}>Welcome Back</h2>
                    <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                        Sign in to continue to Quest Generator
                    </p>
                </div>

                {/* Form */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#334155'
                    }}>
                        <Mail size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                        Email Address
                    </label>
                    <input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleLogin()}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            fontSize: '0.95rem',
                            border: '2px solid #e0f2fe',
                            borderRadius: '10px',
                            transition: 'all 0.2s',
                            outline: 'none'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#67e8f9';
                            e.target.style.boxShadow = '0 0 0 3px rgba(103, 232, 249, 0.2)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#e0f2fe';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#334155'
                    }}>
                        <Lock size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                        Password
                    </label>
                    <input
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleLogin()}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            fontSize: '0.95rem',
                            border: '2px solid #e0f2fe',
                            borderRadius: '10px',
                            transition: 'all 0.2s',
                            outline: 'none'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#67e8f9';
                            e.target.style.boxShadow = '0 0 0 3px rgba(103, 232, 249, 0.2)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#e0f2fe';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                </div>

                <button
                    onClick={handleLogin}
                    disabled={loading || !email || !password}
                    className="btn btn-primary"
                    style={{
                        width: '100%',
                        padding: '0.875rem',
                        fontSize: '1rem',
                        fontWeight: '600'
                    }}
                >
                    {loading ? (
                        <>
                            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '3px' }}></div>
                            Signing in...
                        </>
                    ) : (
                        <>
                            <LogIn size={20} />
                            Sign In
                        </>
                    )}
                </button>

                <p style={{
                    textAlign: 'center',
                    marginTop: '1.5rem',
                    color: '#64748b',
                    fontSize: '0.875rem'
                }}>
                    Don't have an account?{' '}
                    <a href="/signup" style={{
                        color: '#06b6d4',
                        fontWeight: '600',
                        textDecoration: 'none'
                    }}>
                        Sign up
                    </a>
                </p>
            </div>
        </div>
    );
}
