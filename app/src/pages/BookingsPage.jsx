import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SERVICES } from '../lib/constants';
import { CalendarDays, MapPin, User, RefreshCw, Plus } from 'lucide-react';

export default function BookingsPage() {
  const { userBookings, refreshBookings } = useAuth();

  const statusConfig = {
    pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    confirmed: { label: 'Confirmed', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
    active: { label: 'Active', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
    completed: { label: 'Completed', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
    cancelled: { label: 'Cancelled', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  };

  return (
    <div className="bookings-page">
      <div className="bookings-header">
        <h1>My Bookings</h1>
        <button className="bookings-refresh" onClick={refreshBookings} title="Refresh">
          <RefreshCw size={18} />
        </button>
      </div>

      {userBookings.length === 0 ? (
        <div className="bookings-empty">
          <CalendarDays size={56} className="bookings-empty-icon" />
          <h3>No bookings yet</h3>
          <p>Book your first service and manage it here</p>
          <Link to="/services" className="btn-primary-app">
            <Plus size={16} /> Browse Services
          </Link>
        </div>
      ) : (
        <div className="bookings-list">
          {userBookings.map(booking => {
            const service = SERVICES.find(s => s.id === booking.service) || {};
            const status = statusConfig[booking.status] || statusConfig.pending;
            return (
              <div key={booking.id} className="booking-card">
                <div className="booking-card-top">
                  <div className="booking-card-service">
                    <span className="booking-card-emoji">{service.icon || '📋'}</span>
                    <div>
                      <h3>{service.name || booking.service}</h3>
                      <span
                        className="booking-card-status"
                        style={{ color: status.color, background: status.bg }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="booking-card-details">
                  <span><CalendarDays size={14} /> {new Date(booking.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {booking.city && <span><MapPin size={14} /> {booking.city}</span>}
                  {booking.assigned_helper && <span><User size={14} /> {booking.assigned_helper}</span>}
                </div>
                {booking.notes && <p className="booking-card-notes">{booking.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
