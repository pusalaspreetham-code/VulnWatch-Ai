import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import { stackApi } from '../api/stack';
import Navbar from '../components/Navbar';
import {
  Shield,
  Layers,
  KeyRound,
  Check,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowRight,
  Plus,
  Package,
  Calendar,
  Building2,
  Tag,
  ShieldCheck
} from 'lucide-react';
import OtpInput from '../components/OtpInput';

export default function DashboardPage() {
  const { user } = useAuth();

  // Stack summary state
  const [stackItems, setStackItems] = useState([]);
  const [loadingStack, setLoadingStack] = useState(true);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStack() {
      try {
        const data = await stackApi.getStackItems();
        setStackItems(data.items || []);
      } catch (err) {
        console.error('Failed to load stack count:', err);
      } finally {
        setLoadingStack(false);
      }
    }
    loadStack();
  }, []);

  const handleRequestOtp = async () => {
    setRequestingOtp(true);
    setError('');
    setMessage('');
    try {
      const res = await authApi.requestChangePasswordOtp();
      setOtpSent(true);
      setMessage(res.message);
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (!otpCode || otpCode.length !== 6) {
      setError('Please provide the 6-digit verification code sent to your email.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.changePassword(currentPassword, newPassword, otpCode);
      setMessage(res.message);
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpCode('');
      setOtpSent(false);
    } catch (err) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Active';

  return (
    <div>
      <Navbar />

      <div className="dashboard-container">
        {/* Welcome / Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em' }}>
              Vulnerability Monitoring Dashboard
            </h1>
            <span className="status-pill active">
              <span className="status-pill-dot"></span>
              Active Monitor
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.925rem', marginTop: 6 }}>
            Real-time advisory intelligence tracking for your registered software infrastructure.
          </p>
        </div>

        {/* 1. Technology Stack Monitoring Section */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Layers size={20} color="#0f172a" strokeWidth={2.2} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  Technology Stack Monitoring
                </h2>
                <span className="count-badge">
                  {loadingStack ? '...' : `${stackItems.length} monitored`}
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: 540 }}>
                Your software products and exact installed versions are monitored against real-time vulnerability advisories.
              </p>
            </div>

            <Link
              to="/stack"
              className="btn-primary"
              style={{ width: 'auto', padding: '9px 16px', textDecoration: 'none' }}
            >
              <span>Manage Stack</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          {loadingStack ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
              Checking monitored technologies...
            </div>
          ) : stackItems.length === 0 ? (
            <div className="empty-state-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="empty-state-icon-sm">
                  <Package size={22} color="#0f172a" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>
                    No technologies monitored yet
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.825rem' }}>
                    Register your operating systems, databases, web servers, or runtimes to start monitoring advisories.
                  </div>
                </div>
              </div>

              <Link
                to="/stack"
                className="btn-secondary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={15} strokeWidth={2.2} />
                <span>Add First Technology</span>
              </Link>
            </div>
          ) : (
            <div>
              <div className="stack-preview-grid">
                {stackItems.slice(0, 4).map((item) => (
                  <div key={item.id} className="stack-preview-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                        {item.product_name}
                      </div>
                      <span className="version-pill-sm">
                        v{item.installed_version}
                      </span>
                    </div>
                    {item.vendor && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                        {item.vendor}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {stackItems.length > 4 && (
                <div style={{ textAlign: 'right', marginTop: 10 }}>
                  <Link to="/stack" style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}>
                    + View all {stackItems.length} software products &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Account Overview Section */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ShieldCheck size={20} color="#0f172a" strokeWidth={2.2} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              Account Overview
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div className="stat-tile">
              <div className="stat-tile-label">Account Email</div>
              <div className="stat-tile-value">{user?.email}</div>
            </div>

            <div className="stat-tile">
              <div className="stat-tile-label">Account Status</div>
              <div className="stat-tile-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={16} strokeWidth={2.5} color="#10b981" />
                <span>{user?.is_verified ? 'Verified & Active' : 'Unverified'}</span>
              </div>
            </div>

            {user?.id && (
              <div className="stat-tile">
                <div className="stat-tile-label">Analyst ID</div>
                <div className="stat-tile-value">#{user.id}</div>
              </div>
            )}

            <div className="stat-tile">
              <div className="stat-tile-label">Registered Since</div>
              <div className="stat-tile-value">{formattedDate}</div>
            </div>
          </div>
        </div>

        {/* 3. Account Security Section */}
        <div className="dashboard-card" id="security">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <KeyRound size={20} color="#0f172a" strokeWidth={2.2} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              Account Security & Password
            </h2>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 20 }}>
            To safeguard your vulnerability advisory monitoring, password updates require an authorization code sent to your registered email (<strong>{user?.email}</strong>).
          </p>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="alert alert-success">
              <Check size={16} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="form-input"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
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
            </div>

            {/* Verification Code Box */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 20, borderRadius: 10, marginTop: 4, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.925rem', color: '#0f172a' }}>
                    Email Verification Code
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Send code to <strong>{user?.email}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={requestingOtp}
                  className="btn-secondary"
                >
                  <RefreshCw size={13} className={requestingOtp ? 'animate-spin-fast' : ''} />
                  {otpSent ? 'Resend Code' : 'Send Code'}
                </button>
              </div>

              {otpSent && (
                <div style={{ animation: 'stepFadeIn 0.3s ease forwards' }}>
                  <OtpInput
                    email={user?.email}
                    purpose="CHANGE_PASSWORD"
                    onOtpComplete={(code) => setOtpCode(code)}
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !otpSent || otpCode.length !== 6}
              className="btn-primary"
            >
              {submitting ? 'Updating Password...' : 'Confirm and Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
