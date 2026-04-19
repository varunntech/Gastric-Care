import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

// Fix for double eye icon on some browsers
const style = document.createElement('style');
style.textContent = `
  input::-ms-reveal,
  input::-ms-clear {
    display: none;
  }
`;
document.head.append(style);

const LoginPage = () => {
  const navigate = useNavigate();
  const { loginWithEmail, loginWithGoogle } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      navigate('/');
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        // Try Custom Fallback (OTP Reset Password)
        try {
          const resp = await fetch('/api/custom_login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await resp.json();
          if (data.success) {
             // Mock login in session storage for the app to see
             localStorage.setItem('user', JSON.stringify(data.user));
             // Sync cookies for Flask
             document.cookie = `username=${data.user.displayName}; path=/`;
             document.cookie = `useremail=${data.user.email}; path=/`;
             window.location.href = '/'; // Full refresh to sync all states
             return;
          }
        } catch (fallbackErr) {
          console.error("Fallback login failed", fallbackErr);
        }
      }
      setError(err.code ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      setError(err.code ? err.message : 'Google Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="auth-page">
        {/* Left Side - Visual */}
        <div className="auth-visual">
          <div className="auth-visual-content">
            <h1 className="auth-visual-title">
              Welcome Back to<br />GastricCare
            </h1>
            <p className="auth-visual-subtitle">
              Your trusted companion for gastric cancer risk assessment and early detection. 
              Sign in to access your personalized health dashboard.
            </p>
            <div className="auth-visual-features">
              <div className="auth-feature">
                <div className="auth-feature-icon">✓</div>
                <span>AI-powered risk analysis</span>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">✓</div>
                <span>Secure & private health data</span>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">✓</div>
                <span>Instant results & reports</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="auth-form-side">
          <div className="auth-card animate-fade-in">
            <div className="auth-card-header">
              <h2 className="auth-card-title">Sign In</h2>
              <p className="auth-card-subtitle">
                Enter your credentials to access your account
              </p>
            </div>

            {error && (
              <div className="error-message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button 
              type="button" 
              className="btn btn-google"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="divider">or continue with email</div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Email Address <span>*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    type="email"
                    id="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Password <span>*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    className="form-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px', marginBottom: '24px' }}>
                <Link 
                  to="/forgot-password" 
                  style={{ 
                    fontSize: '0.875rem', 
                    color: 'var(--primary-600)', 
                    textDecoration: 'none',
                    fontWeight: '500'
                  }}
                >
                  Forgot Password?
                </Link>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary btn-full btn-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="auth-footer">
              Don't have an account?{' '}
              <Link to="/signup">Create one</Link>
            </div>
          </div>
        </div>
      </div>
  );
};

export default LoginPage;
