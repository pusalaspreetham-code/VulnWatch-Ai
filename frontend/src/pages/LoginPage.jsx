import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import OtpInput from '../components/OtpInput';
import { authApi } from '../api/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Unverified account handling
  const [needsVerification, setNeedsVerification] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);

  const { login, handleVerified } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (err.requiresVerification) {
        setNeedsVerification(true);
        setError('Your email is not verified yet. Please enter the verification code sent to your email.');
      } else {
        setError(err.message || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (code) => {
    const codeToSubmit = code || otpValue;
    if (!codeToSubmit || codeToSubmit.length !== 6) return;

    setOtpVerifying(true);
    setError('');
    try {
      const res = await authApi.verifyRegistrationOtp(email, codeToSubmit);
      handleVerified(res.user);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to verify code.');
    } finally {
      setOtpVerifying(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-badge">
            <Shield size={18} strokeWidth={2.2} />
            <span>VulnWatch AI</span>
          </div>
          <h1 className="auth-title">
            {needsVerification ? 'Verify Account' : 'Welcome back'}
          </h1>
          <p className="auth-subtitle">
            {needsVerification
              ? `Enter the 6-digit verification code sent to ${email}`
              : 'Sign in to access your vulnerability intelligence dashboard'}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        {!needsVerification ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-container">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@domain.com"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <Link
                  to="/forgot-password"
                  style={{ color: '#0f172a', fontSize: '0.8rem', fontWeight: 500, textDecoration: 'none' }}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="form-input"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-btn"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 8 }}>
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight size={16} />
            </button>

            <div className="auth-links" style={{ justifyContent: 'center' }}>
              <span style={{ color: '#64748b' }}>Don't have an account?</span>{' '}
              <Link to="/register" style={{ marginLeft: 6 }}>Create account</Link>
            </div>
          </form>
        ) : (
          <div style={{ animation: 'stepFadeIn 0.3s ease forwards' }}>
            <OtpInput
              email={email}
              purpose="REGISTER"
              onOtpComplete={(code) => {
                setOtpValue(code);
                handleVerifyOtp(code);
              }}
            />
            <button
              type="button"
              onClick={() => handleVerifyOtp()}
              disabled={otpVerifying || otpValue.length !== 6}
              className="btn-primary"
              style={{ marginTop: 20 }}
            >
              {otpVerifying ? 'Verifying...' : 'Complete Verification'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setNeedsVerification(false)}
                className="btn-secondary"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
