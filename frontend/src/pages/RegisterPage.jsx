import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import { Shield, AlertCircle, Check, ArrowRight, Eye, EyeOff } from 'lucide-react';
import OtpInput from '../components/OtpInput';

export default function RegisterPage() {
  const [step, setStep] = useState(1); // Step 1: Form, Step 2: OTP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const { handleVerified } = useAuth();
  const navigate = useNavigate();

  // Password rules validation check
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasDigit && hasSpecial;

  const handleSubmitDetails = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!isPasswordValid) {
      setError('Please fulfill all password requirements.');
      return;
    }

    setLoading(true);
    try {
      await authApi.register(email, password);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify) => {
    const code = codeToVerify || otpCode;
    if (!code || code.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await authApi.verifyRegistrationOtp(email, code);
      handleVerified(res.user);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
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
            {step === 1 ? 'Create Account' : 'Verify Your Email'}
          </h1>
          <p className="auth-subtitle">
            {step === 1
              ? 'Start tracking vulnerabilities for your tech stack'
              : `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="step-bar">
          <div className="step-indicator active"></div>
          <div className={`step-indicator ${step === 2 ? 'active' : ''}`}></div>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSubmitDetails}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@domain.com"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
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

            {/* Dynamic Minimalist Password Checklist */}
            <div className="password-rules">
              <div className={`rule-item ${hasMinLength ? 'valid' : ''}`}>
                <Check size={13} strokeWidth={hasMinLength ? 2.5 : 1.5} /> At least 8 characters
              </div>
              <div className={`rule-item ${hasUpper && hasLower ? 'valid' : ''}`}>
                <Check size={13} strokeWidth={hasUpper && hasLower ? 2.5 : 1.5} /> Upper & lowercase letters
              </div>
              <div className={`rule-item ${hasDigit ? 'valid' : ''}`}>
                <Check size={13} strokeWidth={hasDigit ? 2.5 : 1.5} /> At least one number
              </div>
              <div className={`rule-item ${hasSpecial ? 'valid' : ''}`}>
                <Check size={13} strokeWidth={hasSpecial ? 2.5 : 1.5} /> At least one special character
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="form-input"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 8 }}>
              {loading ? 'Creating Account...' : 'Continue'}
              <ArrowRight size={16} />
            </button>

            <div className="auth-links" style={{ justifyContent: 'center' }}>
              <span style={{ color: '#64748b' }}>Already have an account?</span>{' '}
              <Link to="/login" style={{ marginLeft: 6 }}>Sign in</Link>
            </div>
          </form>
        ) : (
          <div style={{ animation: 'stepFadeIn 0.3s ease forwards' }}>
            <OtpInput
              email={email}
              purpose="REGISTER"
              onOtpComplete={(code) => {
                setOtpCode(code);
                handleVerifyOtp(code);
              }}
            />

            <button
              type="button"
              onClick={() => handleVerifyOtp()}
              disabled={loading || otpCode.length !== 6}
              className="btn-primary"
              style={{ marginTop: 20 }}
            >
              {loading ? 'Verifying...' : 'Verify and Activate'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary"
              >
                Back to Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
