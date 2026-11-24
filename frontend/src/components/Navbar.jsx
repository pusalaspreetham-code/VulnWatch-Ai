import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LayoutDashboard, Layers, KeyRound, LogOut, Bell, Menu, X } from 'lucide-react';

export default function Navbar({ alertCount = 0 }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDashboardActive = location.pathname === '/' || location.pathname === '/dashboard';
  const isStackActive = location.pathname === '/stack';
  const isAlertsActive = location.pathname === '/alerts';

  const scrollToSecurity = (e) => {
    setMobileOpen(false);
    if (isDashboardActive) {
      e.preventDefault();
      const el = document.getElementById('security');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const links = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={15} />, active: isDashboardActive },
    { to: '/stack', label: 'Monitored Stack', icon: <Layers size={15} />, active: isStackActive },
    {
      to: '/alerts',
      label: 'Alerts',
      icon: <Bell size={15} />,
      active: isAlertsActive,
      badge: alertCount > 0 ? (alertCount > 9 ? '9+' : alertCount) : null,
    },
    {
      to: '/#security',
      label: 'Account Security',
      icon: <KeyRound size={15} />,
      active: false,
      onClick: scrollToSecurity,
    },
  ];

  return (
    <nav
      className="dashboard-nav"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 8px 0 rgba(15,23,42,0.06)',
      }}
    >
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 24px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: '#0f172a',
            fontWeight: 800,
            fontSize: '1.05rem',
            letterSpacing: '-0.02em',
          }}>
            <Shield size={20} strokeWidth={2.5} />
            <span>VulnWatch <span style={{ color: '#6366f1' }}>AI</span></span>
          </div>
        </Link>

        <div
          className="nav-desktop-links"
          style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}
        >
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              onClick={l.onClick}
              className={`nav-tab-link ${l.active ? 'active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: l.active ? 700 : 500,
                color: l.active ? '#0f172a' : '#64748b',
                background: l.active ? '#f1f5f9' : 'transparent',
                position: 'relative',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {l.icon}
              <span>{l.label}</span>
              {l.badge && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 999,
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  minWidth: 18,
                  height: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}>
                  {l.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 999,
            fontSize: '0.78rem',
            color: '#475569',
            fontWeight: 500,
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }} className="nav-desktop-links">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#fff',
              color: '#475569',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
            <span className="nav-desktop-links">Logout</span>
          </button>

          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="nav-hamburger"
            style={{
              display: 'none',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              color: '#0f172a',
            }}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 8px 24px rgba(15,23,42,0.1)',
          padding: '12px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          animation: 'slideDown 0.2s cubic-bezier(0.16,1,0.3,1) forwards',
          zIndex: 99,
        }}>
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              onClick={l.onClick || (() => setMobileOpen(false))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: l.active ? 700 : 500,
                color: l.active ? '#0f172a' : '#475569',
                background: l.active ? '#f1f5f9' : 'transparent',
              }}
            >
              {l.icon}
              <span>{l.label}</span>
              {l.badge && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 999,
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                }}>
                  {l.badge}
                </span>
              )}
            </Link>
          ))}
          <div style={{
            borderTop: '1px solid #e2e8f0',
            marginTop: 8,
            paddingTop: 10,
            fontSize: '0.78rem',
            color: '#94a3b8',
            paddingLeft: 14,
          }}>
            Signed in as <strong style={{ color: '#475569' }}>{user?.email}</strong>
          </div>
          <button
            onClick={logout}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', marginTop: 8 }}
            title="Sign out of VulnWatch AI"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </nav>
  );
}
