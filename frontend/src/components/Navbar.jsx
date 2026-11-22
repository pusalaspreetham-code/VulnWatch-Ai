import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LayoutDashboard, Layers, KeyRound, LogOut } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isDashboardActive = location.pathname === '/' || location.pathname === '/dashboard';
  const isStackActive = location.pathname === '/stack';

  const scrollToSecurity = (e) => {
    if (isDashboardActive) {
      e.preventDefault();
      const el = document.getElementById('security');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <nav className="dashboard-nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div className="brand-badge" style={{ marginBottom: 0 }}>
            <Shield size={18} strokeWidth={2.2} />
            <span>VulnWatch AI</span>
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link
            to="/"
            className={`nav-tab-link ${isDashboardActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={15} />
            <span>Dashboard</span>
          </Link>

          <Link
            to="/stack"
            className={`nav-tab-link ${isStackActive ? 'active' : ''}`}
          >
            <Layers size={15} />
            <span>Monitored Stack</span>
          </Link>

          <a
            href="/#security"
            onClick={scrollToSecurity}
            className="nav-tab-link"
          >
            <KeyRound size={15} />
            <span>Account Security</span>
          </a>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="user-pill">
          <span className="user-status-dot"></span>
          <span>{user?.email}</span>
        </div>
        <button
          onClick={logout}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px' }}
          title="Sign out of VulnWatch AI"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
