import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SERVICES, PLAN_DETAILS } from '../lib/constants';
import { SERVICE_ICONS, SERVICE_COLORS } from '../components/ServiceIcons';
import { Shield, Clock, Star, ChevronRight, Crown, Sparkles } from 'lucide-react';

export default function HomePage() {
  const { user, profile, userPlan, userBookings } = useAuth();

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const recentBookings = userBookings.slice(0, 2);
  const activePlan = userPlan ? PLAN_DETAILS[userPlan.plan_name] : null;

  const statusColors = {
    pending: '#F59E0B',
    confirmed: '#3B82F6',
    active: '#34D399',
    completed: '#94A3B8',
    cancelled: '#EF4444',
  };

  return (
    <div className="home-page">
      <section className="home-welcome">
        <div className="home-welcome-text">
          <p className="home-greeting">{getGreeting()} 👋</p>
          <h1 className="home-name">{firstName}</h1>
          <p className="home-subtitle">Find trusted help for your home</p>
        </div>
      </section>

      <section className="home-plan-section">
        {userPlan && activePlan ? (
          <div className="home-plan-card" style={{ borderColor: activePlan.color + '40' }}>
            <div className="home-plan-header">
              <span className="home-plan-badge" style={{ background: activePlan.gradient }}>
                {activePlan.emoji} {activePlan.name}
              </span>
              <span className="home-plan-status">Active</span>
            </div>
            <div className="home-plan-details">
              <div className="home-plan-stat">
                <span className="home-plan-stat-label">Replacements</span>
                <span className="home-plan-stat-value">
                  {userPlan.replacements_total - userPlan.replacements_used} remaining
                </span>
                <div className="home-plan-progress">
                  <div
                    className="home-plan-progress-fill"
                    style={{
                      width: `${((userPlan.replacements_total - userPlan.replacements_used) / userPlan.replacements_total) * 100}%`,
                      background: activePlan.gradient,
                    }}
                  ></div>
                </div>
              </div>
              <div className="home-plan-stat">
                <span className="home-plan-stat-label">Expires</span>
                <span className="home-plan-stat-value">
                  {new Date(userPlan.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
            <Link to="/profile?tab=packages" className="home-plan-link">
              View Plan Details <ChevronRight size={16} />
            </Link>
          </div>
        ) : (
          <Link to="/profile?tab=packages" className="home-plan-cta">
            <div className="home-plan-cta-content">
              <Crown size={28} />
              <div>
                <h3>Get a Plan</h3>
                <p>Unlock replacement guarantees & priority support</p>
              </div>
            </div>
            <ChevronRight size={20} />
          </Link>
        )}
      </section>

      <div className="home-trust">
        <span className="home-trust-chip"><Shield size={14} /> Verified Helpers</span>
        <span className="home-trust-chip"><Clock size={14} /> 24hr Deployment</span>
        <span className="home-trust-chip"><Star size={14} /> 4.9 Rating</span>
      </div>

      <section className="home-section">
        <div className="home-section-header">
          <h2>Our Services</h2>
          <Link to="/services" className="home-see-all">See All <ChevronRight size={14} /></Link>
        </div>
        <div className="home-category-grid">
          {SERVICES.map(s => {
            const Icon = SERVICE_ICONS[s.id];
            const bgColor = SERVICE_COLORS[s.id];
            return (
              <Link key={s.id} to={`/services/${s.id}`} className="home-category-card">
                <div className="home-category-icon" style={{ background: bgColor }}>
                  {Icon ? <Icon size={24} color="#0F0F0F" /> : <span>{s.icon}</span>}
                </div>
                <span className="home-category-name">{s.shortName}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {recentBookings.length > 0 && (
        <section className="home-section">
          <div className="home-section-header">
            <h2>Recent Bookings</h2>
            <Link to="/bookings" className="home-see-all">View All <ChevronRight size={14} /></Link>
          </div>
          <div className="home-bookings-list">
            {recentBookings.map(b => {
              const service = SERVICES.find(s => s.id === b.service) || {};
              return (
                <div key={b.id} className="home-booking-card">
                  <div className="home-booking-icon">{service.icon || '📋'}</div>
                  <div className="home-booking-info">
                    <span className="home-booking-name">{service.name || b.service}</span>
                    <span className="home-booking-date">
                      {new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <span
                    className="home-booking-status"
                    style={{ color: statusColors[b.status] || '#94A3B8' }}
                  >
                    {b.status?.charAt(0).toUpperCase() + b.status?.slice(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="home-promo">
        <Sparkles size={20} />
        <div>
          <h3>Premium Home Help</h3>
          <p>Verified, trained & background-checked helpers</p>
        </div>
      </section>

      <div className="home-stats">
        <div className="home-stat"><strong>12K+</strong><span>Families Served</span></div>
        <div className="home-stat"><strong>4.9</strong><span>Avg Rating</span></div>
        <div className="home-stat"><strong>24hr</strong><span>Deployment</span></div>
      </div>
    </div>
  );
}
