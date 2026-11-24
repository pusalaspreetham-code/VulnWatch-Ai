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
  ChevronDown,
} from 'lucide-react';
import OtpInput from '../components/OtpInput';

// ─── Collapsible Section ──────────────────────────────────────────────────────
function CollapsibleSection({ icon, title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
      transition: 'box-shadow 0.2s',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon}
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{title}</span>
          {badge}
        </div>
        <ChevronDown
          size={18}
          color="#94a3b8"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)', flexShrink: 0 }}
        />
      </button>
      {open && (
        <div style={{ padding: '0 24px 24px', animation: 'slideDown 0.22s cubic-bezier(0.16,1,0.3,1) forwards' }}>
          {children}
        </div>
      )}
    </div>
  );
}

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
      setMatchMessage(err.message || 'Scan failed.');
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
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Active';

  const vulnerableCount = alertSummary ? (alertSummary.vulnerable || 0) + (alertSummary.confirmed || 0) : 0;
  const isAllClear = !loadingAlerts && alertSummary && vulnerableCount === 0 && alertSummary.total >= 0;
  const coverageItems = coverageData?.items || [];

  const severityTiles = [
    { label: 'Critical', count: alertSummary?.critical || 0, activeColor: '#dc2626', activeBg: '#fef2f2', activeBorder: '#fecaca', nav: '/alerts?severity=Critical' },
    { label: 'High',     count: alertSummary?.high     || 0, activeColor: '#ea580c', activeBg: '#fff7ed', activeBorder: '#fed7aa', nav: '/alerts?severity=High'     },
    { label: 'Medium',   count: alertSummary?.medium   || 0, activeColor: '#d97706', activeBg: '#fffbeb', activeBorder: '#fde68a', nav: '/alerts?severity=Medium'   },
    { label: 'Low',      count: alertSummary?.low      || 0, activeColor: '#16a34a', activeBg: '#f0fdf4', activeBorder: '#bbf7d0', nav: '/alerts?severity=Low'      },
    { label: 'All',      count: alertSummary?.total    || 0, activeColor: '#6366f1', activeBg: '#eef2ff', activeBorder: '#c7d2fe', nav: '/alerts'                   },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navbar alertCount={vulnerableCount || alertSummary?.total || 0} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Page Header ─────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                Vulnerability Monitor
              </h1>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: '0.72rem', fontWeight: 700, background: '#f0fdf4',
                color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 999, padding: '2px 10px',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                Active Monitor
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 4 }}>
              Real-time advisory intelligence for your registered software stack
            </p>
          </div>
          <button
            onClick={handleRunMatching}
            disabled={runningMatch}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px',
              background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10,
              fontWeight: 700, fontSize: '0.875rem',
              cursor: runningMatch ? 'not-allowed' : 'pointer',
              opacity: runningMatch ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <RefreshCw size={15} style={{ animation: runningMatch ? 'spin 0.8s linear infinite' : 'none' }} />
            {runningMatch ? 'Scanning…' : 'Run Vulnerability Scan'}
          </button>
        </div>

        {/* ── Scan Result Banner ───────────────────── */}
        {matchMessage && (
          <div style={{
            background: matchMessage.toLowerCase().includes('vulnerable') ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${matchMessage.toLowerCase().includes('vulnerable') ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: 10, padding: '12px 18px', fontSize: '0.875rem',
            color: matchMessage.toLowerCase().includes('vulnerable') ? '#991b1b' : '#166534',
            display: 'flex', alignItems: 'center', gap: 10,
            animation: 'slideDown 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
          }}>
            {matchMessage.toLowerCase().includes('vulnerable')
              ? <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
              : <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0 }} />
            }
            <span>{matchMessage}</span>
          </div>
        )}

        {/* ── VULNERABILITY DETECTION (main card) ─── */}
        <div style={{
          background: '#fff',
          border: `1px solid ${vulnerableCount > 0 ? '#fecaca' : '#e2e8f0'}`,
          borderLeft: `4px solid ${vulnerableCount > 0 ? '#ef4444' : isAllClear ? '#10b981' : '#e2e8f0'}`,
          borderRadius: 14, padding: '24px',
          boxShadow: vulnerableCount > 0 ? '0 2px 12px rgba(239,68,68,0.08)' : '0 1px 4px rgba(15,23,42,0.05)',
        }}>
          {/* Card header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bell size={20} color={vulnerableCount > 0 ? '#ef4444' : '#0f172a'} strokeWidth={2.2} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Vulnerability Detection</h2>
              {vulnerableCount > 0 ? (
                <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800, padding: '2px 10px' }}>
                  {vulnerableCount} Vulnerable
                </span>
              ) : !loadingAlerts && (
                <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px' }}>
                  All Clear
                </span>
              )}
            </div>
            <Link to="/alerts" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              border: '1px solid #e2e8f0', borderRadius: 8, textDecoration: 'none',
              fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', background: '#f8fafc',
            }}>
              View All Alerts <ArrowRight size={13} />
            </Link>
          </div>

          {/* Severity tiles */}
          {loadingAlerts ? (
            <div style={{ padding: '28px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
              Evaluating advisory intelligence…
            </div>
          ) : stackItems.length === 0 ? (
            <div style={{
              background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10,
              padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: '#f1f5f9', borderRadius: 10, padding: 12 }}>
                  <Package size={22} color="#64748b" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>No software registered for monitoring</div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 2 }}>Add your software stack to begin vulnerability scanning</div>
                </div>
              </div>
              <Link to="/stack" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                background: '#0f172a', color: '#fff', borderRadius: 10, textDecoration: 'none',
                fontSize: '0.8rem', fontWeight: 700,
              }}>
                <Plus size={14} /> Add Software
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
              {severityTiles.map(({ label, count, activeColor, activeBg, activeBorder, nav }) => (
                <div
                  key={label}
                  onClick={() => navigate(nav)}
                  title={`View ${label} advisories`}
                  style={{
                    background: count > 0 ? activeBg : '#f8fafc',
                    border: `1px solid ${count > 0 ? activeBorder : '#e2e8f0'}`,
                    borderRadius: 12, padding: '16px 12px', textAlign: 'center',
                    cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: '1.9rem', fontWeight: 800, color: count > 0 ? activeColor : '#cbd5e1', lineHeight: 1 }}>
                    {count}
                  </div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: count > 0 ? activeColor : '#94a3b8', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Monitored Stack Coverage (collapsible) ── */}
        {coverageItems.length > 0 && (
          <CollapsibleSection
            icon={<Layers size={18} color="#0f172a" strokeWidth={2.2} />}
            title="Stack Coverage"
            defaultOpen={false}
            badge={
              <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>
                {coverageItems.length} products
              </span>
            }
          >
            {coverageData?.summary && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{ fontSize: '0.78rem', background: '#f1f5f9', color: '#475569', borderRadius: 8, padding: '4px 10px', fontWeight: 600 }}>
                  Active Feeds: <strong>{coverageData.summary.supportedCount || 0}</strong>
                </span>
                <span style={{ fontSize: '0.78rem', background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontWeight: 600 }}>
                  Pending Feeds: <strong>{coverageData.summary.unsupportedCount || 0}</strong>
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {coverageItems.map((item) => {
                const isVulnerable = item.healthStatus === 'vulnerable';
                const isSafe = item.healthStatus === 'safe';
                const isNeedsReview = item.healthStatus === 'needs_review';
                const isUnsupported = !item.isSupported;
                return (
                  <div key={item.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px',
                    background: '#fafbfd',
                    border: `1px solid ${isVulnerable ? '#fecaca' : '#e2e8f0'}`,
                    borderLeft: `3px solid ${isVulnerable ? '#ef4444' : isSafe ? '#10b981' : isNeedsReview ? '#f59e0b' : '#cbd5e1'}`,
                    borderRadius: 8, gap: 10, flexWrap: 'wrap',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{item.productName}</span>
                        <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', borderRadius: 6, padding: '1px 7px', fontFamily: 'monospace', fontWeight: 600 }}>
                          v{item.installedVersion}
                        </span>
                      </div>
                      {item.vendor && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{item.vendor}</div>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isVulnerable && (
                        <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={11} /> Vulnerable ({item.vulnerabilitiesCount || 1})
                        </span>
                      )}
                      {isNeedsReview && (
                        <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, padding: '2px 10px' }}>Review</span>
                      )}
                      {isSafe && (
                        <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Check size={11} /> Safe
                        </span>
                      )}
                      {isUnsupported && (
                        <span style={{ background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 20, fontSize: '0.72rem', padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title="No official advisory feed configured for this vendor">
                          <HelpCircle size={11} /> Feed Pending
                        </span>
                      )}
                      <Link to="/alerts" style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>Alerts →</Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {stackItems.length > coverageItems.length && (
              <div style={{ textAlign: 'right', marginTop: 12 }}>
                <Link to="/stack" style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}>
                  + View all {stackItems.length} software products →
                </Link>
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* ── Account Overview (collapsible) ─────── */}
        <CollapsibleSection
          icon={<ShieldCheck size={18} color="#0f172a" strokeWidth={2.2} />}
          title="Account Overview"
          defaultOpen={false}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { label: 'Account Email',    value: user?.email },
              { label: 'Account Status',   value: user?.is_verified ? '✓ Verified & Active' : 'Unverified' },
              { label: 'Analyst ID',       value: user?.id ? `#${user.id}` : '—' },
              { label: 'Registered Since', value: formattedDate },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem', wordBreak: 'break-all' }}>{value}</div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* ── Account Security (collapsible) ──────── */}
        <div id="security">
          <CollapsibleSection
            icon={<KeyRound size={18} color="#0f172a" strokeWidth={2.2} />}
            title="Account Security & Password"
            defaultOpen={false}
          >
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 20 }}>
              Password updates require an email verification code sent to <strong>{user?.email}</strong>.
            </p>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            {message && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#16a34a', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Check size={15} strokeWidth={2.5} style={{ flexShrink: 0 }} /> {message}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>Current Password</label>
                <input
                  type="password" required value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••••••"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'} required value={newPassword}
                      onChange={e => setNewPassword(e.target.value)} placeholder="••••••••••••"
                      style={{ width: '100%', padding: '10px 40px 10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>Confirm New Password</label>
                  <input
                    type="password" required value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••••••"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Verification Code Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>Email Verification Code</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Send code to <strong>{user?.email}</strong></div>
                  </div>
                  <button
                    type="button" onClick={handleRequestOtp} disabled={requestingOtp}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#0f172a', fontSize: '0.8rem', fontWeight: 600, cursor: requestingOtp ? 'not-allowed' : 'pointer' }}
                  >
                    <RefreshCw size={13} style={{ animation: requestingOtp ? 'spin 0.8s linear infinite' : 'none' }} />
                    {otpSent ? 'Resend Code' : 'Send Code'}
                  </button>
                </div>

                {otpSent && (
                  <div style={{ animation: 'slideDown 0.25s cubic-bezier(0.16,1,0.3,1) forwards' }}>
                    <OtpInput email={user?.email} purpose="CHANGE_PASSWORD" onOtpComplete={code => setOtpCode(code)} />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !otpSent || otpCode.length !== 6}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                  background: submitting || !otpSent || otpCode.length !== 6 ? '#94a3b8' : '#0f172a',
                  color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem',
                  cursor: submitting || !otpSent || otpCode.length !== 6 ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {submitting ? 'Updating…' : 'Confirm and Update Password'}
              </button>
            </form>
          </CollapsibleSection>
        </div>

      </div>
    </div>
  );
}
