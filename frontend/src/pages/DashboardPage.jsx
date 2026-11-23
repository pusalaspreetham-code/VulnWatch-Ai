import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import { stackApi } from '../api/stack';
import { matchesApi } from '../api/matches';
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
  ShieldCheck,
  AlertTriangle,
  Bell,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import OtpInput from '../components/OtpInput';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Stack state
  const [stackItems, setStackItems] = useState([]);
  const [loadingStack, setLoadingStack] = useState(true);

  // Vulnerability alert summary & coverage state
  const [alertSummary, setAlertSummary] = useState(null);
  const [coverageData, setCoverageData] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [runningMatch, setRunningMatch] = useState(false);
  const [matchMessage, setMatchMessage] = useState('');

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

  const loadData = async () => {
    try {
      const [stackRes, summaryRes, coverageRes] = await Promise.all([
        stackApi.getStackItems().catch(() => ({ items: [] })),
        matchesApi.getMatchSummary().catch(() => ({ summary: null })),
        matchesApi.getCoverageReport().catch(() => null),
      ]);

      setStackItems(stackRes.items || []);
      setAlertSummary(summaryRes.summary);
      setCoverageData(coverageRes);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoadingStack(false);
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunMatching = async () => {
    setRunningMatch(true);
    setMatchMessage('');
    try {
      const res = await matchesApi.runMatching();
      setMatchMessage(res.message);
      await loadData();
    } catch (err) {
      setMatchMessage(err.message || 'Matching scan failed.');
    } finally {
      setRunningMatch(false);
    }
  };

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

  const vulnerableCount = alertSummary ? (alertSummary.vulnerable || 0) + (alertSummary.confirmed || 0) : 0;
  const hasAlerts = alertSummary && (alertSummary.total > 0 || vulnerableCount > 0);
  const criticalOrHigh = alertSummary ? alertSummary.critical + alertSummary.high : 0;

  return (
    <div>
      <Navbar alertCount={vulnerableCount || alertSummary?.total || 0} />

      <div className="dashboard-container">
        {/* Welcome / Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
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

            <button
              onClick={handleRunMatching}
              disabled={runningMatch}
              className="btn-primary"
              style={{ width: 'auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <RefreshCw size={15} className={runningMatch ? 'animate-spin-fast' : ''} />
              <span>{runningMatch ? 'Scanning Stack...' : 'Run Vulnerability Scan'}</span>
            </button>
          </div>
        </div>

        {/* Scan Result Feedback Banner */}
        {matchMessage && (
          <div style={{
            background: matchMessage.toLowerCase().includes('vulnerable') ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${matchMessage.toLowerCase().includes('vulnerable') ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: '0.875rem',
            color: matchMessage.toLowerCase().includes('vulnerable') ? '#991b1b' : '#166534',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            {matchMessage.toLowerCase().includes('vulnerable') ? (
              <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0 }} />
            )}
            <span>{matchMessage}</span>
          </div>
        )}

        {/* 1. Vulnerability Detection & Severity Cards */}
        <div className="dashboard-card" style={{
          borderLeft: vulnerableCount > 0 ? '4px solid #ef4444' : hasAlerts ? '4px solid #f59e0b' : '4px solid #10b981',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Bell size={20} color={vulnerableCount > 0 ? '#ef4444' : '#0f172a'} strokeWidth={2.2} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  Vulnerability Detection
                </h2>
                {vulnerableCount > 0 ? (
                  <span style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    borderRadius: 20,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 10px',
                  }}>
                    {vulnerableCount} Vulnerable
                  </span>
                ) : stackItems.length > 0 ? (
                  <span style={{
                    background: '#f0fdf4',
                    color: '#16a34a',
                    border: '1px solid #bbf7d0',
                    borderRadius: 20,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 10px',
                  }}>
                    Clean / No Vulnerabilities
                  </span>
                ) : null}
              </div>
              <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: 580 }}>
                Exact installed versions evaluated against official vendor security advisories and version bounds.
              </p>
            </div>

            <Link
              to="/alerts"
              className="btn-secondary"
              style={{ width: 'auto', padding: '8px 16px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>View All Alerts</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {loadingAlerts ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
              Evaluating vulnerability intelligence...
            </div>
          ) : stackItems.length === 0 ? (
            <div className="empty-state-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="empty-state-icon-sm">
                  <Package size={22} color="#0f172a" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>
                    No software registered for monitoring
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.825rem' }}>
                    Add your operating systems, databases, web servers, or runtimes to begin automated advisory matching.
                  </div>
                </div>
              </div>

              <Link
                to="/stack"
                className="btn-primary"
                style={{ width: 'auto', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={15} strokeWidth={2.2} />
                <span>Add Monitored Technology</span>
              </Link>
            </div>
          ) : (
            <div>
              {/* Interactive Severity Breakdown Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 18 }}>
                <div
                  onClick={() => navigate('/alerts?severity=Critical')}
                  style={{
                    background: (alertSummary?.critical || 0) > 0 ? '#fef2f2' : '#f8fafc',
                    border: `1px solid ${(alertSummary?.critical || 0) > 0 ? '#fecaca' : '#e2e8f0'}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Click to view Critical advisories"
                >
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: (alertSummary?.critical || 0) > 0 ? '#dc2626' : '#94a3b8', lineHeight: 1 }}>
                    {alertSummary?.critical || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: (alertSummary?.critical || 0) > 0 ? '#dc2626' : '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Critical
                  </div>
                </div>

                <div
                  onClick={() => navigate('/alerts?severity=High')}
                  style={{
                    background: (alertSummary?.high || 0) > 0 ? '#fff7ed' : '#f8fafc',
                    border: `1px solid ${(alertSummary?.high || 0) > 0 ? '#fed7aa' : '#e2e8f0'}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Click to view High advisories"
                >
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: (alertSummary?.high || 0) > 0 ? '#ea580c' : '#94a3b8', lineHeight: 1 }}>
                    {alertSummary?.high || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: (alertSummary?.high || 0) > 0 ? '#ea580c' : '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    High
                  </div>
                </div>

                <div
                  onClick={() => navigate('/alerts?severity=Medium')}
                  style={{
                    background: (alertSummary?.medium || 0) > 0 ? '#fffbeb' : '#f8fafc',
                    border: `1px solid ${(alertSummary?.medium || 0) > 0 ? '#fde68a' : '#e2e8f0'}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Click to view Medium advisories"
                >
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: (alertSummary?.medium || 0) > 0 ? '#d97706' : '#94a3b8', lineHeight: 1 }}>
                    {alertSummary?.medium || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: (alertSummary?.medium || 0) > 0 ? '#d97706' : '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Medium
                  </div>
                </div>

                <div
                  onClick={() => navigate('/alerts?severity=Low')}
                  style={{
                    background: (alertSummary?.low || 0) > 0 ? '#f0fdf4' : '#f8fafc',
                    border: `1px solid ${(alertSummary?.low || 0) > 0 ? '#bbf7d0' : '#e2e8f0'}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Click to view Low advisories"
                >
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: (alertSummary?.low || 0) > 0 ? '#16a34a' : '#94a3b8', lineHeight: 1 }}>
                    {alertSummary?.low || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: (alertSummary?.low || 0) > 0 ? '#16a34a' : '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Low
                  </div>
                </div>

                <div
                  onClick={() => navigate('/alerts')}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '12px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                  title="View all advisories"
                >
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                    {alertSummary?.total || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total Notices
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Monitored Stack & Advisory Coverage Matrix */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Layers size={20} color="#0f172a" strokeWidth={2.2} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  Monitored Stack & Advisory Coverage
                </h2>
                <span className="count-badge">
                  {loadingStack ? '...' : `${stackItems.length} monitored`}
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: 600 }}>
                Transparent distinction between products with active official security feeds and catalog items pending advisory sources.
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
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#64748b' }}>
              No software items registered yet.
            </div>
          ) : (
            <div>
              {/* Coverage stats pills */}
              {coverageData && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span style={{ fontSize: '0.78rem', background: '#f1f5f9', color: '#475569', borderRadius: 8, padding: '4px 10px', fontWeight: 600 }}>
                    Active Feed Coverage: <strong>{coverageData.summary?.supportedCount || 0}</strong> products
                  </span>
                  <span style={{ fontSize: '0.78rem', background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontWeight: 600 }}>
                    Pending Advisory Feed: <strong>{coverageData.summary?.unsupportedCount || 0}</strong> products
                  </span>
                </div>
              )}

              {/* Stack items coverage list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(coverageData?.items || stackItems).slice(0, 6).map((item) => {
                  const isVulnerable = item.healthStatus === 'vulnerable';
                  const isSafe = item.healthStatus === 'safe';
                  const isNeedsReview = item.healthStatus === 'needs_review';
                  const isUnsupported = item.healthStatus === 'unsupported' || item.isSupported === false;

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: '#fafbfd',
                        border: `1px solid ${isVulnerable ? '#fecaca' : '#e2e8f0'}`,
                        borderLeft: isVulnerable ? '4px solid #ef4444' : isSafe ? '4px solid #10b981' : isNeedsReview ? '4px solid #f59e0b' : '4px solid #cbd5e1',
                        borderRadius: 8,
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                              {item.productName || item.product_name}
                            </span>
                            <span className="version-pill-sm">
                              v{item.installedVersion || item.installed_version}
                            </span>
                            {item.category && (
                              <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#64748b', borderRadius: 6, padding: '2px 8px' }}>
                                {item.category}
                              </span>
                            )}
                          </div>
                          {item.vendor && (
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                              {item.vendor}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status chip */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isVulnerable && (
                          <span style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: 20,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}>
                            <AlertTriangle size={13} />
                            Vulnerable ({item.vulnerabilitiesCount || 1})
                          </span>
                        )}

                        {isNeedsReview && (
                          <span style={{
                            background: '#fffbeb',
                            color: '#d97706',
                            border: '1px solid #fde68a',
                            borderRadius: 20,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '3px 12px',
                          }}>
                            Review Required
                          </span>
                        )}

                        {isSafe && (
                          <span style={{
                            background: '#f0fdf4',
                            color: '#16a34a',
                            border: '1px solid #bbf7d0',
                            borderRadius: 20,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '3px 12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}>
                            <Check size={13} strokeWidth={2.5} />
                            {item.statusLabel || 'Patched / Safe'}
                          </span>
                        )}

                        {isUnsupported && (
                          <span style={{
                            background: '#f8fafc',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                            borderRadius: 20,
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            padding: '3px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }} title="No official advisory feed configured for this vendor in current version">
                            <HelpCircle size={12} color="#94a3b8" />
                            Feed Pending
                          </span>
                        )}

                        <Link
                          to="/alerts"
                          style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}
                        >
                          Advisories &rarr;
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {stackItems.length > 6 && (
                <div style={{ textAlign: 'right', marginTop: 12 }}>
                  <Link to="/stack" style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}>
                    + View all {stackItems.length} software products in stack &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Account Overview Section */}
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

        {/* 4. Account Security Section */}
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
