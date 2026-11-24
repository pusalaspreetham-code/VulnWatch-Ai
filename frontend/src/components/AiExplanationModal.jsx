import React, { useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Shield,
  ExternalLink,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

function renderInline(text) {
  if (!text) return null;
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Code: `code`
    const codeMatch = remaining.match(/`([^`]+)`/);

    const matchIndices = [];
    if (boldMatch) matchIndices.push({ type: 'bold', index: boldMatch.index, len: boldMatch[0].length, content: boldMatch[1] });
    if (codeMatch) matchIndices.push({ type: 'code', index: codeMatch.index, len: codeMatch[0].length, content: codeMatch[1] });

    if (matchIndices.length === 0) {
      parts.push(remaining);
      break;
    }

    matchIndices.sort((a, b) => a.index - b.index);
    const first = matchIndices[0];

    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }

    if (first.type === 'bold') {
      parts.push(<strong key={key++} style={{ color: '#0f172a', fontWeight: 700 }}>{first.content}</strong>);
    } else if (first.type === 'code') {
      parts.push(
        <code key={key++} style={{
          background: '#f1f5f9', color: '#0f172a', padding: '1px 6px',
          borderRadius: 4, fontFamily: 'monospace', fontSize: '0.85em', fontWeight: 600,
        }}>
          {first.content}
        </code>
      );
    }

    remaining = remaining.slice(first.index + first.len);
  }

  return parts;
}

export function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      elements.push(<div key={key++} style={{ height: 10 }} />);
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <div key={key++} style={{ fontWeight: 800, fontSize: '0.95rem', color: '#431407', marginTop: 14, marginBottom: 4 }}>
          {renderInline(line.slice(4))}
        </div>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <div key={key++} style={{ fontWeight: 800, fontSize: '1.05rem', color: '#3b0764', marginTop: 16, marginBottom: 6, borderBottom: '1px solid #f3e8ff', paddingBottom: 4 }}>
          {renderInline(line.slice(3))}
        </div>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <div key={key++} style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a', marginTop: 18, marginBottom: 8 }}>
          {renderInline(line.slice(2))}
        </div>
      );
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={key++} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '3px 0', paddingLeft: 6 }}>
          <span style={{ color: '#7c3aed', fontWeight: 700, lineHeight: 1.5 }}>•</span>
          <span style={{ flex: 1, color: '#334155' }}>{renderInline(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    const numMatch = line.match(/^([0-9]+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={key++} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '4px 0', paddingLeft: 6 }}>
          <span style={{ color: '#7c3aed', fontWeight: 700, minWidth: 18 }}>{numMatch[1]}.</span>
          <span style={{ flex: 1, color: '#334155' }}>{renderInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    elements.push(
      <p key={key++} style={{ margin: '4px 0', color: '#334155', lineHeight: 1.6 }}>
        {renderInline(line)}
      </p>
    );
  }

  return elements;
}

export default function AiExplanationModal({
  isOpen,
  onClose,
  match,
  data,
  loading,
  error,
  onExplain,
  onRefresh,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !match) return null;

  const isUnconfigured = error?.includes('API key is not configured') || data?.configured === false;
  const title = match.title || match.advisory_title || 'Advisory Finding';
  const cveId = match.cveId || match.cve_id;
  const productName = match.productName || match.stack_product_name || match.affected_product_name || 'Software';
  const installedVersion = match.installedVersion || match.installed_version || 'current';
  const severity = match.severity || 'Medium';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 18,
          width: '100%',
          maxWidth: 860,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
          borderBottom: '1px solid #e9d5ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)', flexShrink: 0,
            }}>
              <Sparkles size={22} color="#ffffff" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#3b0764' }}>
                  AI Advisory Intelligence & Remediation
                </span>
                <span style={{
                  background: '#e9d5ff', color: '#581c87', border: '1px solid #d8b4fe',
                  borderRadius: 20, fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px',
                }}>
                  {data?.model || 'Gemini 2.5 Flash'}
                </span>
                {data?.cached && (
                  <span style={{ fontSize: '0.72rem', color: '#7e22ce', fontWeight: 700 }}>
                    (Cached)
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b21a8', marginTop: 3 }}>
                Grounded analysis for <strong>{productName}</strong> (v{installedVersion}) · {cveId || title}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #e9d5ff',
              borderRadius: 10,
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#6b21a8',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
            title="Close popup (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{
          padding: '24px 28px',
          overflowY: 'auto',
          flex: 1,
          lineHeight: 1.65,
          color: '#1e293b',
          fontSize: '0.925rem',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: '#faf5ff', border: '2px solid #d8b4fe',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16, animation: 'spin 1.5s linear infinite',
              }}>
                <Sparkles size={28} color="#7c3aed" />
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#3b0764' }}>
                Analyzing Vulnerability with Google Gemini AI...
              </div>
              <div style={{ color: '#64748b', fontSize: '0.825rem', marginTop: 6, maxWidth: 440, margin: '6px auto 0' }}>
                Evaluating verified vendor advisory releases and structuring impact for version {installedVersion}.
              </div>
            </div>
          ) : error || (!data?.success && data?.message) ? (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dc2626', fontWeight: 700, marginBottom: 8 }}>
                <AlertCircle size={20} />
                <span>Unable to load AI Analysis</span>
              </div>
              <p style={{ color: '#991b1b', fontSize: '0.875rem', lineHeight: 1.5 }}>
                {isUnconfigured
                  ? 'To enable AI-powered advisory summaries and step-by-step remediation guidance, add your GEMINI_API_KEY to backend/.env. (Deterministic version detection remains 100% active and accurate without AI).'
                  : (error || data?.message || 'Failed to fetch AI explanation.')}
              </p>
              {!isUnconfigured && (
                <button
                  onClick={() => onExplain && onExplain(true)}
                  style={{
                    marginTop: 14, background: '#dc2626', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '8px 16px', fontSize: '0.825rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Retry Analysis
                </button>
              )}
            </div>
          ) : data?.explanation ? (
            <div>
              {/* Quick Advisory Context Bar */}
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
                padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 10, fontSize: '0.825rem',
              }}>
                <div>
                  Severity: <strong style={{
                    color: severity === 'Critical' ? '#dc2626' : severity === 'High' ? '#ea580c' : '#d97706',
                  }}>{severity}</strong>
                  {match.fixedVersion || match.fixed_version ? (
                    <span style={{ marginLeft: 10 }}>
                      Fixed in: <strong style={{ color: '#16a34a' }}>v{match.fixedVersion || match.fixed_version}</strong>
                    </span>
                  ) : null}
                </div>
                {match.sourceUrl || match.source_url ? (
                  <a
                    href={match.sourceUrl || match.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#4f46e5', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <span>Official Vendor Advisory</span>
                    <ExternalLink size={12} />
                  </a>
                ) : null}
              </div>

              {/* Formatted Markdown Content */}
              <div style={{
                fontSize: '0.925rem',
                color: '#1e293b',
                lineHeight: 1.7,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                {renderMarkdown(data.explanation)}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              No AI analysis generated yet. Click "Explain with AI" to generate.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#64748b' }}>
            <Shield size={14} color="#7c3aed" />
            <span>Grounded strictly in verified advisory records · Single source of truth</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {data?.explanation && (
              <button
                onClick={() => onRefresh && onRefresh(true)}
                disabled={loading}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin-fast' : ''} />
                <span>Re-analyze</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

