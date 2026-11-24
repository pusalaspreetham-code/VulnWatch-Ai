import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { matchesApi } from '../api/matches';
import Navbar from '../components/Navbar';
import {
  Bell,
  Shield,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  EyeOff,
  ExternalLink,
  ChevronDown,
  Filter,
  Search,
  Check,
  Layers,
  HelpCircle,
  AlertCircle,
  X,
  Sparkles,
  Bot,
} from 'lucide-react';

const SEVERITY_STYLES = {
  Critical: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', dot: '#dc2626' },
  High:     { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c', dot: '#ea580c' },
  Medium:   { bg: '#fffbeb', border: '#fde68a', text: '#d97706', dot: '#d97706' },
  Low:      { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', dot: '#16a34a' },
};

const STATUS_LABELS = {
  vulnerable:      { label: 'Vulnerable',      bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  confirmed:       { label: 'Confirmed',       bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  potential_match: { label: 'Needs Review',   bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  needs_review:    { label: 'Needs Review',   bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  not_affected:    { label: 'Not Affected',    bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  dismissed:       { label: 'Dismissed',       bg: '#f1f5f9', text: '#94a3b8', border: '#e2e8f0' },
};

function SeverityBadge({ severity }) {
  const s = SEVERITY_STYLES[severity] || { bg: '#f1f5f9', border: '#e2e8f0', text: '#64748b', dot: '#94a3b8' };
  return (
    <span style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.text,
      borderRadius: 20,
      fontSize: '0.72rem',
      fontWeight: 700,
      padding: '2px 10px',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {severity || 'Unknown'}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.potential_match;
  return (
    <span style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.text,
      borderRadius: 20,
      fontSize: '0.72rem',
      fontWeight: 700,
      padding: '2px 10px',
    }}>
      {s.label}
    </span>
  );
}

// Simple markdown renderer for Gemini AI output
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty line
    if (!line.trim()) {
      elements.push(<div key={key++} style={{ height: 8 }} />);
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      elements.push(
        <div key={key++} style={{ fontWeight: 800, fontSize: '0.9rem', color: '#3b0764', marginTop: 10, marginBottom: 4, letterSpacing: '-0.01em' }}>
          {renderInline(line.slice(4))}
        </div>
      );
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      elements.push(
        <div key={key++} style={{ fontWeight: 800, fontSize: '0.95rem', color: '#3b0764', marginTop: 12, marginBottom: 6 }}>
          {renderInline(line.slice(3))}
        </div>
      );
      continue;
    }

    // Bullet
    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={key++} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.86rem', color: '#4c1d95', lineHeight: 1.6, paddingLeft: 4 }}>
          <span style={{ marginTop: 6, width: 5, height: 5, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      elements.push(
        <div key={key++} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.86rem', color: '#4c1d95', lineHeight: 1.6, paddingLeft: 4 }}>
          <span style={{ fontWeight: 700, color: '#7c3aed', flexShrink: 0, minWidth: 20 }}>{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <div key={key++} style={{ fontSize: '0.86rem', color: '#4c1d95', lineHeight: 1.65 }}>
        {renderInline(line)}
      </div>
    );
  }

  return elements;
}

function renderInline(text) {
  // Bold **text** and *text*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: '#3b0764' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: '#ede9fe', color: '#6d28d9', padding: '1px 5px', borderRadius: 4, fontSize: '0.82em', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// Clean raw scraped advisory description
function cleanAdvisoryDescription(text) {
  if (!text) return null;
  // Remove known scraped garbage patterns
  let cleaned = text
    .replace(/Advertising Advertising cookies[\s\S]{0,500}?CancelSave preferences/gi, '')
    .replace(/Below are bulletins for security[\s\S]{0,200}?RSS feed\)?/gi, '')
    .replace(/\(https?:\/\/[^)]+\)/g, '') // remove inline markdown links content
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // convert [text](url) → text
    .replace(/\|\s*Date Released[\s\S]*?---\s*/g, '') // remove table headers
    .replace(/\|[\s\S]+?\|\s*\n/g, '') // remove table rows
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Truncate at 500 chars to show only the useful part
  if (cleaned.length > 500) cleaned = cleaned.slice(0, 500) + '…';
  return cleaned || null;
}

function AiExplanationView({ data, loading, error, onExplain, onRefresh, match }) {
  if (loading) {
    return (
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '16px 20px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: '#475569',
        fontSize: '0.875rem'
      }}>
        <RefreshCw size={18} className="animate-spin-fast" color="#6366f1" />
        <span>Consulting Google Gemini AI (analyzing official advisory bulletin)...</span>
      </div>
    );
  }

  if (error || (data && !data.success)) {
    const isUnconfigured = data?.configured === false;
    return (
      <div style={{
        background: isUnconfigured ? '#eff6ff' : '#fef2f2',
        border: `1px solid ${isUnconfigured ? '#bfdbfe' : '#fecaca'}`,
        borderRadius: 8,
        padding: '16px 20px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {isUnconfigured ? (
            <Bot size={18} color="#2563eb" style={{ marginTop: 2, flexShrink: 0 }} />
          ) : (
            <AlertCircle size={18} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: isUnconfigured ? '#1e40af' : '#991b1b', marginBottom: 4 }}>
              {isUnconfigured ? 'Google Gemini AI Setup' : 'AI Advisory Explanation Unavailable'}
            </div>
            <div style={{ fontSize: '0.825rem', color: isUnconfigured ? '#1e3a8a' : '#7f1d1d', lineHeight: 1.5, marginBottom: 10 }}>
              {isUnconfigured
                ? 'To enable AI-powered advisory summaries and step-by-step remediation guidance, add your GEMINI_API_KEY to backend/.env. (Deterministic version detection remains 100% active and accurate without AI).'
                : (error || data?.message || 'Failed to fetch AI explanation.')}
            </div>
            {!isUnconfigured && (
              <button
                onClick={() => onExplain(true)}
                style={{
                  background: '#fff',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Retry Request
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.explanation) {
    return (
      <div style={{
        background: '#f8fafc',
        border: '1px dashed #cbd5e1',
        borderRadius: 8,
        padding: '12px 18px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={18} color="#6366f1" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
              Explain with AI
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Summarize this advisory and get cautious remediation steps grounded in vendor data.
            </div>
          </div>
        </div>
        <button
          onClick={() => onExplain(false)}
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            width: 'auto',
            padding: '7px 14px',
            fontSize: '0.825rem',
            background: '#4f46e5',
            borderColor: '#4f46e5',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={14} />
          <span>Explain with AI</span>
        </button>
      </div>
    );
  }

  // Explanation is available
  return (
    <div style={{
      background: '#faf5ff',
      border: '1px solid #e9d5ff',
      borderRadius: 8,
      padding: '16px 20px',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 10,
        borderBottom: '1px solid #f3e8ff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={18} color="#7c3aed" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#581c87' }}>
            AI Advisory Analysis & Remediation
          </span>
          <span style={{
            background: '#f3e8ff',
            color: '#6b21a8',
            border: '1px solid #d8b4fe',
            borderRadius: 12,
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '2px 8px',
          }}>
            {data.model || 'Gemini 2.5 Flash'}
          </span>
          {data.cached && (
            <span style={{ fontSize: '0.7rem', color: '#9333ea', fontWeight: 600 }}>
              (Cached)
            </span>
          )}
        </div>
        <button
          onClick={() => onRefresh(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#7c3aed',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <RefreshCw size={12} />
          <span>Re-analyze</span>
        </button>
      </div>

      {/* Content — rendered markdown only, no raw text */}
      <div style={{
        fontSize: '0.875rem',
        color: '#3b0764',
        lineHeight: 1.6,
        marginBottom: 14,
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        {renderMarkdown(data.explanation)}
      </div>

      {/* Footer / Ground Truth Disclaimer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        paddingTop: 10,
        borderTop: '1px solid #f3e8ff',
        fontSize: '0.75rem',
        color: '#7e22ce',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={13} color="#9333ea" />
          <span>Grounded strictly in verified advisory data · Deterministic matcher is single source of truth</span>
        </div>
        {match.source_url && (
          <a
            href={match.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#6b21a8', fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <span>Original Vendor Advisory</span>
            <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { user } = useAuth();
  const location = useLocation();

  // Active view tab: 'alerts' or 'coverage'
  const [activeTab, setActiveTab] = useState('alerts');

  // Query params
  const searchParams = new URLSearchParams(location.search);
  const initialSeverity = searchParams.get('severity') || '';

  const [matches, setMatches]           = useState([]);
  const [total, setTotal]               = useState(0);
  const [coverageData, setCoverageData] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [runningMatch, setRunningMatch] = useState(false);
  const [runMessage, setRunMessage]     = useState('');
  const [runError, setRunError]         = useState('');

  // Filters
  const [statusFilter, setStatusFilter]     = useState('');
  const [severityFilter, setSeverityFilter] = useState(initialSeverity);
  const [searchTerm, setSearchTerm]         = useState('');

  const [expandedId, setExpandedId]         = useState(null);
  const [updatingId, setUpdatingId]         = useState(null);

  // Gemini AI Explanation State
  const [aiLoading, setAiLoading]           = useState({});
  const [aiData, setAiData]                 = useState({});
  const [aiError, setAiError]               = useState({});

  const fetchMatches = async (status = statusFilter, severity = severityFilter, search = searchTerm) => {
    setLoading(true);
    try {
      const [matchesRes, covRes] = await Promise.all([
        matchesApi.getMatches({
          status,
          severity,
          search,
        }),
        matchesApi.getCoverageReport().catch(() => null),
      ]);

      const fetchedMatches = matchesRes.matches || [];
      setMatches(fetchedMatches);
      setTotal(matchesRes.total || 0);
      setCoverageData(covRes);

      // Prepopulate matches that already have a stored AI explanation
      const initialAi = {};
      fetchedMatches.forEach((m) => {
        if (m.ai_explanation) {
          initialAi[m.id] = {
            success: true,
            configured: true,
            explanation: m.ai_explanation,
            cached: true,
            sourceUrl: m.source_url,
            cveId: m.cve_id,
          };
        }
      });
      if (Object.keys(initialAi).length > 0) {
        setAiData((prev) => ({ ...initialAi, ...prev }));
      }
    } catch (err) {
      console.error('Failed to load matches:', err);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchMatches(statusFilter, severityFilter, searchTerm);
  }, [severityFilter]);

  const handleRunMatching = async () => {
    setRunningMatch(true);
    setRunMessage('');
    setRunError('');
    try {
      const res = await matchesApi.runMatching();
      setRunMessage(res.message);
      await fetchMatches(statusFilter, severityFilter, searchTerm);
    } catch (err) {
      setRunError(err.message || 'Vulnerability scan failed. Please try again.');
    } finally {
      setRunningMatch(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMatches(statusFilter, severityFilter, searchTerm);
  };

  const handleFilterChange = (statusVal, severityVal) => {
    setStatusFilter(statusVal);
    setSeverityFilter(severityVal);
    fetchMatches(statusVal, severityVal, searchTerm);
  };

  const handleClearFilters = () => {
    setStatusFilter('');
    setSeverityFilter('');
    setSearchTerm('');
    fetchMatches('', '', '');
  };

  const handleStatusUpdate = async (matchId, newStatus) => {
    setUpdatingId(matchId);
    try {
      await matchesApi.updateMatchStatus(matchId, newStatus, null);
      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, status: newStatus } : m))
      );
      // Reload coverage in background
      matchesApi.getCoverageReport().then(setCoverageData).catch(() => {});
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const vulnerableCount = matches.filter((m) => m.status === 'vulnerable' || m.status === 'confirmed').length;
  const needsReviewCount = matches.filter((m) => m.status === 'potential_match' || m.status === 'needs_review').length;
  const safeCount = matches.filter((m) => m.status === 'not_affected').length;

  return (
    <div>
      <Navbar alertCount={vulnerableCount} />

      <div className="dashboard-container">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em' }}>
                  Vulnerability Alerts & Advisory Intelligence
                </h1>
                {vulnerableCount > 0 ? (
                  <span style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    borderRadius: 20,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '3px 12px',
                  }}>
                    {vulnerableCount} Vulnerable
                  </span>
                ) : (
                  <span style={{
                    background: '#f0fdf4',
                    color: '#16a34a',
                    border: '1px solid #bbf7d0',
                    borderRadius: 20,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '3px 12px',
                  }}>
                    All Monitored Items Safe
                  </span>
                )}
              </div>
              <p style={{ color: '#64748b', fontSize: '0.925rem' }}>
                Deterministic comparison of your monitored software versions against official vendor security releases.
              </p>
            </div>

            {/* Run Scan Button */}
            <button
              onClick={handleRunMatching}
              disabled={runningMatch}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'auto', padding: '10px 18px' }}
            >
              <RefreshCw size={15} className={runningMatch ? 'animate-spin-fast' : ''} />
              <span>{runningMatch ? 'Scanning Stack...' : 'Run Vulnerability Scan'}</span>
            </button>
          </div>
        </div>

        {/* Scan feedback banners */}
        {runMessage && (
          <div style={{
            background: runMessage.toLowerCase().includes('vulnerable') ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${runMessage.toLowerCase().includes('vulnerable') ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: '0.875rem',
            color: runMessage.toLowerCase().includes('vulnerable') ? '#991b1b' : '#166534',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <CheckCircle size={16} />
            <span>{runMessage}</span>
          </div>
        )}
        {runError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: '0.875rem', color: '#dc2626', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <XCircle size={16} />
            <span>{runError}</span>
          </div>
        )}

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
          <button
            onClick={() => setActiveTab('alerts')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.925rem',
              fontWeight: 600,
              color: activeTab === 'alerts' ? '#0f172a' : '#64748b',
              borderBottom: activeTab === 'alerts' ? '2px solid #0f172a' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Bell size={16} />
            <span>Advisory Alerts ({total})</span>
          </button>

          <button
            onClick={() => setActiveTab('coverage')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.925rem',
              fontWeight: 600,
              color: activeTab === 'coverage' ? '#0f172a' : '#64748b',
              borderBottom: activeTab === 'coverage' ? '2px solid #0f172a' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Layers size={16} />
            <span>Stack Coverage & Health ({coverageData?.items?.length || 0})</span>
          </button>
        </div>

        {activeTab === 'alerts' ? (
          <div>
            {/* Interactive Metrics / Severity Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
              <div
                onClick={() => handleFilterChange('', '')}
                style={{
                  background: !severityFilter && !statusFilter ? '#0f172a' : '#f8fafc',
                  color: !severityFilter && !statusFilter ? '#fff' : '#0f172a',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '10px 14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{total}</div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>All Alerts</div>
              </div>

              <div
                onClick={() => handleFilterChange('vulnerable', '')}
                style={{
                  background: statusFilter === 'vulnerable' ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${statusFilter === 'vulnerable' ? '#dc2626' : '#fecaca'}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>{vulnerableCount}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vulnerable</div>
              </div>

              <div
                onClick={() => handleFilterChange('', 'Critical')}
                style={{
                  background: severityFilter === 'Critical' ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${severityFilter === 'Critical' ? '#dc2626' : '#fecaca'}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>
                  {matches.filter((m) => m.severity === 'Critical').length}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Critical</div>
              </div>

              <div
                onClick={() => handleFilterChange('', 'High')}
                style={{
                  background: severityFilter === 'High' ? '#fff7ed' : '#f8fafc',
                  border: `1px solid ${severityFilter === 'High' ? '#ea580c' : '#fed7aa'}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ea580c' }}>
                  {matches.filter((m) => m.severity === 'High').length}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>High</div>
              </div>

              <div
                onClick={() => handleFilterChange('', 'Medium')}
                style={{
                  background: severityFilter === 'Medium' ? '#fffbeb' : '#f8fafc',
                  border: `1px solid ${severityFilter === 'Medium' ? '#d97706' : '#fde68a'}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>
                  {matches.filter((m) => m.severity === 'Medium').length}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Medium</div>
              </div>

              <div
                onClick={() => handleFilterChange('not_affected', '')}
                style={{
                  background: statusFilter === 'not_affected' ? '#f0fdf4' : '#f8fafc',
                  border: `1px solid ${statusFilter === 'not_affected' ? '#16a34a' : '#bbf7d0'}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>{safeCount}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Not Affected</div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              {/* Search */}
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 280px', maxWidth: 400 }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by CVE, product, or title..."
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => { setSearchTerm(''); fetchMatches(statusFilter, severityFilter, ''); }}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </form>

              {/* Status and Severity Dropdowns */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <select
                  value={statusFilter}
                  onChange={(e) => handleFilterChange(e.target.value, severityFilter)}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    background: '#fff',
                    color: '#0f172a',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="vulnerable">Vulnerable</option>
                  <option value="potential_match">Needs Review</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="not_affected">Not Affected / Patched</option>
                  <option value="dismissed">Dismissed</option>
                </select>

                <select
                  value={severityFilter}
                  onChange={(e) => handleFilterChange(statusFilter, e.target.value)}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    background: '#fff',
                    color: '#0f172a',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">All Severities</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>

                {(statusFilter || severityFilter || searchTerm) && (
                  <button
                    onClick={handleClearFilters}
                    style={{ border: 'none', background: '#f1f5f9', color: '#475569', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Matches List */}
            {loading ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                Loading vulnerability alerts...
              </div>
            ) : matches.length === 0 ? (
              <div className="dashboard-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'inline-flex', background: '#f0fdf4', borderRadius: '50%', padding: 16 }}>
                    <Shield size={28} color="#16a34a" />
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a', marginBottom: 6 }}>
                  {statusFilter || severityFilter || searchTerm ? 'No matching advisories found' : 'No vulnerability matches found'}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: 440, margin: '0 auto 20px' }}>
                  {statusFilter || severityFilter || searchTerm
                    ? 'Try broadening your search query or clearing active filters.'
                    : 'Your registered software versions were evaluated against collected vendor advisories and no active vulnerabilities were found.'}
                </div>
                {(statusFilter || severityFilter || searchTerm) && (
                  <button
                    onClick={handleClearFilters}
                    className="btn-secondary"
                    style={{ width: 'auto', display: 'inline-flex', padding: '8px 16px' }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {matches.map((match) => {
                  const isExpanded = expandedId === match.id;
                  const isUpdating = updatingId === match.id;
                  const isVulnerable = match.status === 'vulnerable' || match.status === 'confirmed';
                  const sev = match.severity;
                  const sevStyle = SEVERITY_STYLES[sev] || { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b' };

                  return (
                    <div
                      key={match.id}
                      className="dashboard-card"
                      style={{
                        padding: 0,
                        borderLeft: isVulnerable ? '4px solid #ef4444' : `4px solid ${sevStyle.border}`,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Summary Row */}
                      <div
                        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
                        onClick={() => toggleExpand(match.id)}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                            <SeverityBadge severity={sev} />
                            <StatusBadge status={match.status} />

                            {match.cve_id && (
                              <a
                                href={`https://www.cve.org/CVERecord?id=${match.cve_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.8rem',
                                  background: '#f1f5f9',
                                  color: '#0f172a',
                                  borderRadius: 6,
                                  padding: '2px 8px',
                                  fontWeight: 700,
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                                title="View official CVE record"
                              >
                                <span>{match.cve_id}</span>
                                <ExternalLink size={10} color="#64748b" />
                              </a>
                            )}

                            {match.cvss_score && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                                CVSS {match.cvss_score}
                              </span>
                            )}
                          </div>

                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.975rem', marginBottom: 4 }}>
                            {match.advisory_title}
                          </div>

                          <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
                            Your stack: <strong>{match.stack_product_name}</strong> (installed <strong>v{match.installed_version}</strong>)
                            {' · '}
                            Advisory product: <strong>{match.affected_product_name}</strong>
                            {match.fixed_version && (
                              <span style={{ color: '#16a34a', fontWeight: 600, marginLeft: 6 }}>
                                · Fixed in {match.fixed_version}
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronDown
                          size={18}
                          color="#94a3b8"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                        />
                      </div>

                      {/* Expanded View */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid #f1f5f9', padding: '18px 20px', background: '#fafbfd' }}>
                          {/* Reason */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            background: isVulnerable ? '#fef2f2' : '#f1f5f9',
                            border: `1px solid ${isVulnerable ? '#fecaca' : '#e2e8f0'}`,
                            borderRadius: 8,
                            padding: '10px 14px',
                            marginBottom: 16,
                            fontSize: '0.85rem',
                            color: isVulnerable ? '#991b1b' : '#334155',
                          }}>
                            {isVulnerable ? (
                              <AlertTriangle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                            ) : (
                              <CheckCircle size={15} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                            )}
                            <div>
                              <strong>Evaluation:</strong> {match.match_reason}
                            </div>
                          </div>

                          {/* Advisory Description — cleaned scraped content */}
                          {match.advisory_description && cleanAdvisoryDescription(match.advisory_description) && (
                            <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 16, lineHeight: 1.6, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 6, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Advisory Details:</div>
                              {cleanAdvisoryDescription(match.advisory_description)}
                            </div>
                          )}

                          {/* Metadata grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
                            {match.affected_versions_raw && (
                              <div className="stat-tile" style={{ padding: '10px 14px' }}>
                                <div className="stat-tile-label">Affected Versions</div>
                                <div className="stat-tile-value" style={{ fontSize: '0.85rem' }}>{match.affected_versions_raw}</div>
                              </div>
                            )}

                            {match.fixed_version && (
                              <div className="stat-tile" style={{ padding: '10px 14px' }}>
                                <div className="stat-tile-label">Fixed In Version</div>
                                <div className="stat-tile-value" style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 700 }}>{match.fixed_version}</div>
                              </div>
                            )}

                            {match.published_at && (
                              <div className="stat-tile" style={{ padding: '10px 14px' }}>
                                <div className="stat-tile-label">Published Date</div>
                                <div className="stat-tile-value" style={{ fontSize: '0.85rem' }}>
                                  {new Date(match.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                </div>
                              </div>
                            )}

                            {match.source_name && (
                              <div className="stat-tile" style={{ padding: '10px 14px' }}>
                                <div className="stat-tile-label">Official Source</div>
                                <div className="stat-tile-value" style={{ fontSize: '0.85rem' }}>{match.source_name}</div>
                              </div>
                            )}
                          </div>

                          {/* Remediation */}
                          {match.remediation && (
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', fontSize: '0.85rem', color: '#166534', marginBottom: 16 }}>
                              <strong>Remediation Guidance:</strong> {match.remediation}
                            </div>
                          )}

                          {/* AI Explanation & Guidance */}
                          <AiExplanationView
                            match={match}
                            data={aiData[match.id]}
                            loading={Boolean(aiLoading[match.id])}
                            error={aiError[match.id]}
                            onExplain={(refresh) => handleExplainWithAi(match.id, refresh)}
                            onRefresh={(refresh) => handleExplainWithAi(match.id, refresh)}
                          />

                          {/* Actions Bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginRight: 4 }}>Analyst Action:</span>

                            {match.status !== 'confirmed' && (
                              <button
                                onClick={() => handleStatusUpdate(match.id, 'confirmed')}
                                disabled={isUpdating}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                <AlertTriangle size={12} /> Confirm Vulnerable
                              </button>
                            )}

                            {match.status !== 'not_affected' && (
                              <button
                                onClick={() => handleStatusUpdate(match.id, 'not_affected')}
                                disabled={isUpdating}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 8, padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                <Check size={12} strokeWidth={2.5} /> Mark Not Affected
                              </button>
                            )}

                            {match.status !== 'dismissed' && (
                              <button
                                onClick={() => handleStatusUpdate(match.id, 'dismissed')}
                                disabled={isUpdating}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 8, padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                              >
                                <EyeOff size={12} /> Dismiss
                              </button>
                            )}

                            {match.status !== 'potential_match' && (
                              <button
                                onClick={() => handleStatusUpdate(match.id, 'potential_match')}
                                disabled={isUpdating}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', borderRadius: 8, padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                              >
                                <RefreshCw size={12} /> Reset to Review
                              </button>
                            )}

                            {match.source_url && (
                              <a
                                href={match.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, color: '#0f172a', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 }}
                              >
                                <span>Official Source Notice</span>
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Tab 2: Monitored Stack Coverage & Intelligence */
          <div>
            <div className="dashboard-card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Layers size={20} color="#0f172a" strokeWidth={2.2} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  Monitored Stack Coverage Intelligence
                </h2>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 18 }}>
                Overview of advisory feed availability and vulnerability status for each software product in your infrastructure.
              </p>

              {coverageData?.summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                  <div className="stat-tile">
                    <div className="stat-tile-label">Total Monitored</div>
                    <div className="stat-tile-value">{coverageData.summary.totalMonitored}</div>
                  </div>
                  <div className="stat-tile" style={{ borderLeft: '3px solid #10b981' }}>
                    <div className="stat-tile-label">Supported Feeds</div>
                    <div className="stat-tile-value" style={{ color: '#16a34a' }}>{coverageData.summary.supportedCount}</div>
                  </div>
                  <div className="stat-tile" style={{ borderLeft: '3px solid #ef4444' }}>
                    <div className="stat-tile-label">Vulnerable Items</div>
                    <div className="stat-tile-value" style={{ color: '#dc2626' }}>{coverageData.summary.vulnerableCount}</div>
                  </div>
                  <div className="stat-tile" style={{ borderLeft: '3px solid #94a3b8' }}>
                    <div className="stat-tile-label">Pending Feeds</div>
                    <div className="stat-tile-value" style={{ color: '#64748b' }}>{coverageData.summary.unsupportedCount}</div>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(coverageData?.items || []).map((item) => {
                  const isVulnerable = item.healthStatus === 'vulnerable';
                  const isNeedsReview = item.healthStatus === 'needs_review';
                  const isSafe = item.healthStatus === 'safe';
                  const isUnsupported = item.healthStatus === 'unsupported';

                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '16px 20px',
                        background: '#ffffff',
                        border: `1px solid ${isVulnerable ? '#fecaca' : '#e2e8f0'}`,
                        borderLeft: isVulnerable ? '4px solid #ef4444' : isSafe ? '4px solid #10b981' : isNeedsReview ? '4px solid #f59e0b' : '4px solid #cbd5e1',
                        borderRadius: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                            {item.productName}
                          </span>
                          <span className="version-pill-sm">v{item.installedVersion}</span>
                          <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#64748b', borderRadius: 6, padding: '2px 8px' }}>
                            {item.category}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Vendor: <strong>{item.vendor || 'Generic'}</strong>
                          {item.notes && <span> · Note: {item.notes}</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {isVulnerable && (
                          <span style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: 20,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '4px 14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}>
                            <AlertTriangle size={14} />
                            {item.vulnerabilitiesCount} Vulnerability Detected
                          </span>
                        )}

                        {isNeedsReview && (
                          <span style={{
                            background: '#fffbeb',
                            color: '#d97706',
                            border: '1px solid #fde68a',
                            borderRadius: 20,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            padding: '4px 14px',
                          }}>
                            Needs Review ({item.totalAdvisories})
                          </span>
                        )}

                        {isSafe && (
                          <span style={{
                            background: '#f0fdf4',
                            color: '#16a34a',
                            border: '1px solid #bbf7d0',
                            borderRadius: 20,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            padding: '4px 14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}>
                            <Check size={14} strokeWidth={2.5} />
                            {item.statusLabel}
                          </span>
                        )}

                        {isUnsupported && (
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              background: '#f8fafc',
                              color: '#64748b',
                              border: '1px solid #e2e8f0',
                              borderRadius: 20,
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              padding: '4px 12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}>
                              <HelpCircle size={13} color="#94a3b8" />
                              No Feed Configured
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
