import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { Shield, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import OtpInput from '../components/OtpInput';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP + New Password
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.requestForgotPasswordOtp(email);
      setSuccessMessage(res.message);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to request reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(email, otpCode, newPassword);
      setSuccessMessage('Password reset successfully. Redirecting to sign in...');
      setTimeout(() => {
        navigate('/login');
      }, 1800);
    } catch (err) {
      setError(err.message || 'Password reset failed.');
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
          <h1 className="auth-title">Password Recovery</h1>
          <p className="auth-subtitle">
            {step === 1
              ? "Enter your email to receive a secure verification code"
              : `Enter the code sent to ${email} and set your new password`}
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

        {successMessage && (
          <div className="alert alert-success">
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestOtp}>
            <div className="form-group">
              <label className="form-label">Registered Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@domain.com"
                className="form-input"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 8 }}>
              {loading ? 'Sending Code...' : 'Send Verification Code'}
              <ArrowRight size={16} />
            </button>

            <div className="auth-links" style={{ justifyContent: 'center' }}>
              <Link to="/login">Back to Sign In</Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} style={{ animation: 'stepFadeIn 0.3s ease forwards' }}>
            <label className="form-label">6-Digit Verification Code</label>
            <OtpInput
              email={email}
              purpose="FORGOT_PASSWORD"
              onOtpComplete={(code) => setOtpCode(code)}
            />

            <div className="form-group" style={{ marginTop: 18 }}>
              <label className="form-label">New Password</label>
              <div className="input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
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
              {loading ? 'Resetting Password...' : 'Confirm New Password'}
            </button>

            <div className="auth-links" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary"
              >
                Change Email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
