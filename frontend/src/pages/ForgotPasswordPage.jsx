import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

// CSS Fix for double eye icon on some browsers
const style = document.createElement('style');
style.textContent = `
  input::-ms-reveal,
  input::-ms-clear {
    display: none;
  }
`;
document.head.append(style);

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Pass
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [serverOtp, setServerOtp] = useState('');
  const [name, setName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // STEP 1: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await fetch('/api/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      
      setServerOtp(data.otp_check); // In demo mode, we get it back
      setStep(2);
      setMessage('Security code sent to your email!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (otp === serverOtp) {
      setStep(3);
      setError('');
    } else {
      setError('Invalid security code. Please check your email.');
    }
  };

  // STEP 3: Save New Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Logic to save to Firestore (Hybrid)
      await fetch('/api/otp/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, newPassword })
      });
      setMessage('Password updated! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError('Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-content">
          <h1 className="auth-visual-title">Secure Password<br />Recovery</h1>
          <p className="auth-visual-subtitle">
            We've simplified our recovery process. Just enter your email to receive a secure 6-digit code via Brevo.
          </p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card animate-fade-in">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Recovery: Step {step}</h2>
            <p className="auth-card-subtitle">
              {step === 1 && "Enter your email address"}
              {step === 2 && "Enter the 6-digit code sent to you"}
              {step === 3 && "Create your new secure password"}
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {message && <div style={{ background: 'var(--primary-50)', color: 'var(--primary-700)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>{message}</div>}

          {step === 1 && (
            <form onSubmit={handleRequestOtp}>
              <div className="form-group">
                <label className="form-label">Email Address<span>*</span></label>
                <input type="email" className="form-input" value={email} onChange={(e)=>setEmail(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Sending...' : 'Request Recovery Code'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label className="form-label">Standard OTP (6 digits)<span>*</span></label>
                <input type="text" className="form-input" style={{ letterSpacing: '8px', fontSize: '1.5rem', textAlign: 'center' }} value={otp} onChange={(e)=>setOtp(e.target.value)} maxLength="6" required />
              </div>
              <button type="submit" className="btn btn-primary btn-full">Verify Code</button>
              <button type="button" onClick={()=>setStep(1)} style={{ width: '100%', marginTop: '12px', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>Back</button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">Full Name<span>*</span></label>
                <input type="text" placeholder="Enter your real name" className="form-input" value={name} onChange={(e)=>setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password<span>*</span></label>
                <input type="password" placeholder="Min 8 characters" className="form-input" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Updating...' : 'Set New Password & Name'}
              </button>
            </form>
          )}

          <div className="auth-footer" style={{ marginTop: '24px' }}>
            <Link to="/login">Back to Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
