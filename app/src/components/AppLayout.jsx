import { Outlet, NavLink } from 'react-router-dom';
import { Home, Grid, CalendarDays, User, MapPin, Bell, Search, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AppLayout() {
  const { profile } = useAuth();

  return (
    <div className="app-layout" style={{ background: '#0F0F0F', color: '#F1F5F9' }}>
      {/* Desktop Sidebar */}
      <aside className="app-sidebar" style={{ background: '#0F0F0F', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="sidebar-header">
          <div className="sidebar-logo-icon" style={{ background: '#34D399', color: '#0F0F0F' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span style={{ color: '#F1F5F9' }}>MyBuddyMaid</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/home" end className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Home size={18} /> <span>Overview</span>
          </NavLink>
          <NavLink to="/services" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Grid size={18} /> <span>All Services</span>
          </NavLink>
          <NavLink to="/bookings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <CalendarDays size={18} /> <span>My Bookings</span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <User size={18} /> <span>Account</span>
          </NavLink>
        </nav>
        
        <div className="sidebar-search-trigger" style={{ background: '#1A1A1A', borderColor: 'rgba(255,255,255,0.08)' }}>
          <Search size={16} />
          <span>Quick find...</span>
          <kbd style={{ background: '#141414', borderColor: 'rgba(255,255,255,0.08)' }}>⌘K</kbd>
        </div>

        <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="sidebar-user-mini">
            <div className="sum-avatar" style={{ background: 'linear-gradient(135deg, #34D399, #10B981)', color: '#0F0F0F' }}>{profile?.full_name?.charAt(0) || 'U'}</div>
            <div className="sum-info">
              <div className="sum-name" style={{ color: '#F1F5F9' }}>{profile?.full_name || 'Demo User'}</div>
              <div className="sum-plan" style={{ color: '#34D399' }}><Sparkles size={12}/> Premium Plus</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="app-main">
        <header className="app-header" style={{ background: 'rgba(15,15,15,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="app-header-left">
            <button className="app-header-location" style={{ background: '#1A1A1A', borderColor: 'rgba(255,255,255,0.08)', color: '#F1F5F9' }}>
              <MapPin size={14} style={{ color: '#34D399' }} />
              <span>{profile?.city || 'Delhi NCR'}</span>
            </button>
          </div>
          
          <div className="app-header-actions">
            <button className="app-header-btn" style={{ background: '#1A1A1A', borderColor: 'rgba(255,255,255,0.08)', color: '#F1F5F9' }}>
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <div className="mobile-only-avatar" style={{ background: '#34D399', color: '#0F0F0F' }}>{profile?.full_name?.charAt(0) || 'U'}</div>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tabs */}
      <nav className="tab-bar" style={{ background: 'rgba(15,15,15,0.92)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <NavLink to="/home" end className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <Home size={22} /><span>Home</span>
        </NavLink>
        <NavLink to="/services" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <Grid size={22} /><span>Services</span>
        </NavLink>
        <NavLink to="/bookings" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <CalendarDays size={22} /><span>Bookings</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <User size={22} /><span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}
