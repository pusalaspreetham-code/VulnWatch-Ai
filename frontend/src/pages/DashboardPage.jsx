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
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import OtpInput from '../components/OtpInput';
import AiExplanationModal from '../components/AiExplanationModal';

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
  const [expandedProductIds, setExpandedProductIds] = useState({});

  const toggleProductExpand = (id) => {
    setExpandedProductIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Gemini AI Explanation Modal State
  const [modalMatch, setModalMatch]   = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiLoading, setAiLoading]     = useState({});
  const [aiData, setAiData]           = useState({});
  const [aiError, setAiError]         = useState({});

  const handleOpenAiModal = (vuln) => {
    const matchObj = {
      id: vuln.primaryMatchId || vuln.key,
      cve_id: vuln.cveId || null,
      advisory_title: vuln.title,
      severity: vuln.severity,
      status: vuln.status,
      match_reason: vuln.matchReason,
      advisory_description: vuln.description,
      fixed_version: vuln.fixedVersion,
      remediation: vuln.remediation,
      source_url: vuln.sourceUrl || (vuln.sources && vuln.sources[0]?.sourceUrl),
      source_name: vuln.sources && vuln.sources[0]?.sourceName,
    };
    setModalMatch(matchObj);
    setIsModalOpen(true);

    if (vuln.aiExplanation && !aiData[matchObj.id]) {
      setAiData((prev) => ({
        ...prev,
        [matchObj.id]: {
          success: true,
          configured: true,
          explanation: vuln.aiExplanation,
          cached: true,
          sourceUrl: matchObj.source_url,
          cveId: matchObj.cve_id,
        },
      }));
    } else if (vuln.primaryMatchId && !aiData[matchObj.id] && !aiLoading[matchObj.id]) {
      handleExplainWithAi(matchObj.id, false);
    }
  };

  const handleExplainWithAi = async (matchId, refresh = false) => {
    setAiLoading((prev) => ({ ...prev, [matchId]: true }));
    setAiError((prev) => ({ ...prev, [matchId]: '' }));
    try {
      const res = await matchesApi.explainMatch(matchId, refresh);
      setAiData((prev) => ({ ...prev, [matchId]: res }));
      if (!res.success && res.message) {
        setAiError((prev) => ({ ...prev, [matchId]: res.message }));
      }
    } catch (err) {
      setAiError((prev) => ({ ...prev, [matchId]: err.message || 'Failed to generate AI explanation.' }));
    } finally {
      setAiLoading((prev) => ({ ...prev, [matchId]: false }));
    }
  };

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

  const vulnerableCount = alertSummary ? (alertSummary.total || alertSummary.vulnerableCount || 0) : 0;
  const needsReviewCount = alertSummary ? (alertSummary.needsReview || alertSummary.needsReviewCount || 0) : 0;
  const isAllClear = !loadingAlerts && alertSummary && vulnerableCount === 0;
  const coverageProducts = coverageData?.products || coverageData?.items || [];

  const severityTiles = [
    { label: 'Critical', count: alertSummary?.critical || 0, activeColor: '#dc2626', activeBg: '#fef2f2', activeBorder: '#fecaca', nav: '/alerts?severity=Critical' },
    { label: 'High',     count: alertSummary?.high     || 0, activeColor: '#ea580c', activeBg: '#fff7ed', activeBorder: '#fed7aa', nav: '/alerts?severity=High'     },
    { label: 'Medium',   count: alertSummary?.medium   || 0, activeColor: '#d97706', activeBg: '#fffbeb', activeBorder: '#fde68a', nav: '/alerts?severity=Medium'   },
    { label: 'Low',      count: alertSummary?.low      || 0, activeColor: '#16a34a', activeBg: '#f0fdf4', activeBorder: '#bbf7d0', nav: '/alerts?severity=Low'      },
    { label: 'Needs Review', count: needsReviewCount,  activeColor: '#d97706', activeBg: '#fffbeb', activeBorder: '#fde68a', nav: '/alerts?status=potential_match' },
    { label: 'Verified Total', count: vulnerableCount, activeColor: '#0f172a', activeBg: '#f1f5f9', activeBorder: '#cbd5e1', nav: '/alerts?status=vulnerable' },
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

        {/* ── Monitored Product Scan Targets (Separate target per monitored product) ── */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: '24px',
          boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
        }}>
          {/* Section header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Layers size={20} color="#0f172a" strokeWidth={2.2} />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Monitored Product Scan Targets
                </h2>
                <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>
                  {coverageProducts.length} scan targets
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.825rem', marginTop: 4 }}>
                Each monitored software product is evaluated as a distinct scan target with deduplicated advisory matching
              </p>
            </div>

            <Link to="/stack" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              border: '1px solid #e2e8f0', borderRadius: 8, textDecoration: 'none',
              fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', background: '#f8fafc',
            }}>
              <Plus size={13} /> Manage Software Stack
            </Link>
          </div>

          {/* Product targets list */}
          {coverageProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#94a3b8', fontSize: '0.9rem' }}>
              No software registered in your stack. Add products in Stack Management to begin scanning.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {coverageProducts.map((product) => {
                const isExpanded = !!expandedProductIds[product.id];
                const isVulnerable = product.healthStatus === 'vulnerable' || product.vulnerabilityCount > 0;
                const isNeedsReview = product.healthStatus === 'needs_review' || (!isVulnerable && product.needsReviewCount > 0);
                const isSafe = product.healthStatus === 'safe' || (product.isSupported && !isVulnerable && !isNeedsReview);
                const isUnsupported = !product.isSupported || product.healthStatus === 'coverage_unavailable';

                return (
                  <div
                    key={product.id}
                    style={{
                      background: '#fff',
                      border: `1px solid ${isVulnerable ? '#fecaca' : isNeedsReview ? '#fde68a' : '#e2e8f0'}`,
                      borderLeft: `5px solid ${isVulnerable ? '#ef4444' : isNeedsReview ? '#f59e0b' : isSafe ? '#10b981' : '#94a3b8'}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: isVulnerable ? '0 2px 10px rgba(239,68,68,0.06)' : '0 1px 3px rgba(15,23,42,0.04)',
                    }}
                  >
                    {/* Card Top / Header */}
                    <div style={{ padding: '16px 20px', background: '#fcfdfe', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        {/* Title & Version info */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                              {product.productName}
                            </span>
                            <span style={{
                              fontSize: '0.78rem', background: '#f1f5f9', color: '#334155',
                              border: '1px solid #cbd5e1', borderRadius: 6, padding: '2px 8px',
                              fontFamily: 'monospace', fontWeight: 700,
                            }}>
                              v{product.installedVersion}
                            </span>
                            {product.ecosystem && product.ecosystem !== 'General Software' && (
                              <span style={{
                                fontSize: '0.72rem', background: '#eff6ff', color: '#2563eb',
                                border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 8px', fontWeight: 600,
                              }}>
                                {product.ecosystem}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                            Vendor: <strong>{product.vendor || 'Generic'}</strong>
                            {product.originalInput && product.originalInput !== product.productName && (
                              <span style={{ marginLeft: 8, color: '#475569' }}>(Input: {product.originalInput})</span>
                            )}
                            {product.category && product.category !== 'General Software' && (
                              <span style={{ marginLeft: 8, color: '#94a3b8' }}>• {product.category}</span>
                            )}
                          </div>
                        </div>

                        {/* Status Badge & Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          {isVulnerable && (
                            <span style={{
                              background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                              borderRadius: 20, fontSize: '0.75rem', fontWeight: 800, padding: '4px 12px',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}>
                              <AlertTriangle size={13} /> {product.vulnerabilityCount} Confirmed Vulnerable
                            </span>
                          )}
                          {isNeedsReview && !isVulnerable && (
                            <span style={{
                              background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a',
                              borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}>
                              <AlertCircle size={13} /> {product.needsReviewCount} Needs Review
                            </span>
                          )}
                          {isSafe && (
                            <span style={{
                              background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                              borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}>
                              <Check size={13} /> Verified Safe (0 Advisories)
                            </span>
                          )}
                          {isUnsupported && (
                            <span style={{
                              background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0',
                              borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}>
                              <HelpCircle size={13} /> Coverage Unavailable
                            </span>
                          )}

                          <button
                            onClick={() => toggleProductExpand(product.id)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 12px', background: '#f8fafc', border: '1px solid #cbd5e1',
                              borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            <span>{isExpanded ? 'Hide Advisories' : `Advisories (${(product.vulnerabilities?.length || 0) + (product.needsReview?.length || 0)})`}</span>
                            <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                          </button>

                          <Link
                            to={`/alerts?search=${encodeURIComponent(product.productName)}`}
                            style={{
                              fontSize: '0.78rem', color: '#4f46e5', fontWeight: 700,
                              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            Alerts <ArrowRight size={13} />
                          </Link>
                        </div>
                      </div>

                      {/* Product Severity Breakdown Pills */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Verified Severity:
                        </span>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: (product.severityBreakdown?.critical || 0) > 0 ? '#fef2f2' : '#f8fafc',
                          color: (product.severityBreakdown?.critical || 0) > 0 ? '#dc2626' : '#94a3b8',
                          border: `1px solid ${(product.severityBreakdown?.critical || 0) > 0 ? '#fecaca' : '#e2e8f0'}`,
                        }}>
                          Critical: {product.severityBreakdown?.critical || 0}
                        </span>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: (product.severityBreakdown?.high || 0) > 0 ? '#fff7ed' : '#f8fafc',
                          color: (product.severityBreakdown?.high || 0) > 0 ? '#ea580c' : '#94a3b8',
                          border: `1px solid ${(product.severityBreakdown?.high || 0) > 0 ? '#fed7aa' : '#e2e8f0'}`,
                        }}>
                          High: {product.severityBreakdown?.high || 0}
                        </span>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: (product.severityBreakdown?.medium || 0) > 0 ? '#fffbeb' : '#f8fafc',
                          color: (product.severityBreakdown?.medium || 0) > 0 ? '#d97706' : '#94a3b8',
                          border: `1px solid ${(product.severityBreakdown?.medium || 0) > 0 ? '#fde68a' : '#e2e8f0'}`,
                        }}>
                          Medium: {product.severityBreakdown?.medium || 0}
                        </span>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: (product.severityBreakdown?.low || 0) > 0 ? '#f0fdf4' : '#f8fafc',
                          color: (product.severityBreakdown?.low || 0) > 0 ? '#16a34a' : '#94a3b8',
                          border: `1px solid ${(product.severityBreakdown?.low || 0) > 0 ? '#bbf7d0' : '#e2e8f0'}`,
                        }}>
                          Low: {product.severityBreakdown?.low || 0}
                        </span>
                        {product.needsReviewCount > 0 && (
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                            background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a',
                          }}>
                            Needs Review: {product.needsReviewCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expandable Deduplicated Advisories Details */}
                    {isExpanded && (
                      <div style={{ padding: '16px 20px', background: '#ffffff' }}>
                        {/* Confirmed Vulnerabilities */}
                        {product.vulnerabilities && product.vulnerabilities.length > 0 && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#dc2626', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Confirmed Vulnerabilities ({product.vulnerabilities.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {product.vulnerabilities.map((vuln) => (
                                <div
                                  key={vuln.key}
                                  style={{
                                    border: '1px solid #fecaca',
                                    borderRadius: 8,
                                    padding: '12px 16px',
                                    background: '#fff9f9',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <span style={{
                                        fontFamily: 'monospace', fontWeight: 800, fontSize: '0.825rem',
                                        background: '#dc2626', color: '#fff', borderRadius: 4, padding: '2px 7px',
                                      }}>
                                        {vuln.cveId || vuln.key}
                                      </span>
                                      <span style={{
                                        fontSize: '0.72rem', fontWeight: 700, borderRadius: 20, padding: '2px 8px',
                                        background: vuln.severity === 'Critical' ? '#fee2e2' : vuln.severity === 'High' ? '#ffedd5' : '#fef3c7',
                                        color: vuln.severity === 'Critical' ? '#991b1b' : vuln.severity === 'High' ? '#9a3412' : '#92400e',
                                        border: `1px solid ${vuln.severity === 'Critical' ? '#fca5a5' : vuln.severity === 'High' ? '#fdba74' : '#fcd34d'}`,
                                      }}>
                                        {vuln.severity}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAiModal(vuln)}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 5,
                                          background: '#f5f3ff',
                                          border: '1px solid #ddd6fe',
                                          color: '#7c3aed',
                                          borderRadius: 6,
                                          padding: '3px 10px',
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                        }}
                                        title="Open full AI advisory analysis in popup modal"
                                      >
                                        <Sparkles size={12} color="#7c3aed" />
                                        <span>AI Analysis</span>
                                      </button>
                                      {vuln.fixedVersion && (
                                        <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                                          Fixed in: v{vuln.fixedVersion}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                                    {vuln.title}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 8, lineHeight: 1.45 }}>
                                    {vuln.description ? (vuln.description.length > 250 ? vuln.description.slice(0, 250) + '…' : vuln.description) : 'No advisory description provided.'}
                                  </div>

                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: '0.78rem', color: '#64748b' }}>
                                    <div>
                                      Remediation: <strong style={{ color: '#0f172a' }}>{vuln.remediation || 'Apply latest vendor security patch.'}</strong>
                                    </div>
                                    {vuln.sources && vuln.sources.length > 0 && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span>Sources:</span>
                                        {vuln.sources.map((s, sIdx) => s.sourceUrl ? (
                                          <a
                                            key={sIdx}
                                            href={s.sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              color: '#2563eb', textDecoration: 'none', fontWeight: 600,
                                              display: 'inline-flex', alignItems: 'center', gap: 3,
                                            }}
                                          >
                                            {s.sourceName || 'Notice'} <ExternalLink size={10} />
                                          </a>
                                        ) : (
                                          <span key={sIdx}>{s.sourceName}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Needs Review Advisories */}
                        {product.needsReview && product.needsReview.length > 0 && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#d97706', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Needs Review ({product.needsReview.length}) — Not counted as confirmed
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {product.needsReview.map((vuln) => (
                                <div
                                  key={vuln.key}
                                  style={{
                                    border: '1px solid #fde68a',
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    background: '#fffbeb',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#92400e' }}>
                                        {vuln.cveId || vuln.key}
                                      </span>
                                      <span style={{ fontSize: '0.8rem', color: '#78350f', fontWeight: 600 }}>{vuln.title}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAiModal(vuln)}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          background: '#fef3c7',
                                          border: '1px solid #fde68a',
                                          color: '#92400e',
                                          borderRadius: 6,
                                          padding: '2px 8px',
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                        }}
                                        title="Analyze this advisory with Google Gemini AI in popup modal"
                                      >
                                        <Sparkles size={11} color="#92400e" />
                                        <span>AI Analysis</span>
                                      </button>
                                      <Link to={`/alerts?search=${encodeURIComponent(vuln.cveId || vuln.key)}`} style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 700 }}>
                                        Review Alert →
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Safe product state */}
                        {isSafe && (!product.vulnerabilities || product.vulnerabilities.length === 0) && (!product.needsReview || product.needsReview.length === 0) && (
                          <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#166534', fontSize: '0.85rem' }}>
                            ✓ All verified vendor advisory feeds checked. No matching vulnerabilities detected for {product.productName} v{product.installedVersion}.
                          </div>
                        )}

                        {/* Coverage unavailable state */}
                        {isUnsupported && (
                          <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, color: '#64748b', fontSize: '0.85rem' }}>
                            Official security advisory feed or database not yet configured for {product.ecosystem || product.productName}.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

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

      {/* Gemini AI Full Explanation Modal Popup */}
      <AiExplanationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        match={modalMatch}
        data={modalMatch ? aiData[modalMatch.id] : null}
        loading={modalMatch ? Boolean(aiLoading[modalMatch.id]) : false}
        error={modalMatch ? aiError[modalMatch.id] : ''}
        onExplain={(refresh) => modalMatch && handleExplainWithAi(modalMatch.id, refresh)}
        onRefresh={(refresh) => modalMatch && handleExplainWithAi(modalMatch.id, refresh)}
      />
    </div>
  );
}
