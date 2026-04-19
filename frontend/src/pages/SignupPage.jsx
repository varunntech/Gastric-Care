import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const validatePassword = (value) => ({
  length: value.length >= 8,
  lower: /[a-z]/.test(value),
  upper: /[A-Z]/.test(value),
  number: /[0-9]/.test(value),
  special: /[^A-Za-z0-9]/.test(value),
});

const SignupPage = () => {
  const navigate = useNavigate();
  const { signupWithEmail, loginWithGoogle } = useAuth();
  
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordStrength = useMemo(() => validatePassword(password), [password]);
  const isPasswordValid = Object.values(passwordStrength).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError('Please meet all password requirements before continuing.');
      return;
    }

    if (!agreeToTerms) {
      setError('Please agree to the Terms & Conditions.');
      return;
    }

    setLoading(true);
    try {
      await signupWithEmail(name, surname, email, password);
      
      // Auto-send welcome email in background
      fetch('/api/welcome_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, name: name })
      }).catch(console.error);
      
      navigate('/');
    } catch (err) {
      setError(err.code ? err.message : 'Signup failed. Please try again.');
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
      setError(err.code ? err.message : 'Google Signup failed.');
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
              Start Your Health<br />Journey Today
            </h1>
            <p className="auth-visual-subtitle">
              Join thousands of users who trust GastricCare for early gastric cancer 
              detection and personalized risk assessment.
            </p>
            <div className="auth-visual-features">
              <div className="auth-feature">
                <div className="auth-feature-icon">✓</div>
                <span>Free risk assessment tools</span>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">✓</div>
                <span>Personalized health insights</span>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">✓</div>
                <span>Expert-backed recommendations</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="auth-form-side">
          <div className="auth-card animate-fade-in">
            <div className="auth-card-header">
              <h2 className="auth-card-title">Create Account</h2>
              <p className="auth-card-subtitle">
                Fill in your details to get started
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

            <div className="divider">or sign up with email</div>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="firstName">
                    First Name <span>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="text"
                      id="firstName"
                      className="form-input"
                      placeholder="John"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="given-name"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="lastName">
                    Last Name <span>*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="text"
                      id="lastName"
                      className="form-input"
                      placeholder="Doe"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      required
                      autoComplete="family-name"
                    />
                  </div>
                </div>
              </div>

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
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
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

                <div className="password-strength">
                  <p className="strength-title">Password Requirements</p>
                  <div className="strength-checklist">
                    <div className={`strength-item ${passwordStrength.length ? 'valid' : ''}`}>
                      <span className="strength-item-icon">
                        {passwordStrength.length ? '✓' : ''}
                      </span>
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`strength-item ${passwordStrength.lower ? 'valid' : ''}`}>
                      <span className="strength-item-icon">
                        {passwordStrength.lower ? '✓' : ''}
                      </span>
                      <span>One lowercase letter</span>
                    </div>
                    <div className={`strength-item ${passwordStrength.upper ? 'valid' : ''}`}>
                      <span className="strength-item-icon">
                        {passwordStrength.upper ? '✓' : ''}
                      </span>
                      <span>One uppercase letter</span>
                    </div>
                    <div className={`strength-item ${passwordStrength.number ? 'valid' : ''}`}>
                      <span className="strength-item-icon">
                        {passwordStrength.number ? '✓' : ''}
                      </span>
                      <span>One number</span>
                    </div>
                    <div className={`strength-item ${passwordStrength.special ? 'valid' : ''}`}>
                      <span className="strength-item-icon">
                        {passwordStrength.special ? '✓' : ''}
                      </span>
                      <span>One special character</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-wrapper">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    required
                  />
                  <span className="checkbox-label">
                    I agree to the{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer">
                      Terms & Conditions
                    </a>{' '}
                    and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary btn-full btn-lg"
                disabled={loading || !isPasswordValid || !agreeToTerms}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <div className="auth-footer">
              Already have an account?{' '}
              <Link to="/login">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
  );
};

export default SignupPage;
