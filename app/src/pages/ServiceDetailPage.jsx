import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SERVICES } from '../lib/constants';
import { SERVICE_ICONS, SERVICE_COLORS } from '../components/ServiceIcons';
import { ArrowLeft, Check, MapPin, FileText, Loader2, CheckCircle2, Mail, Phone, Headphones, X, MessageCircle } from 'lucide-react';

export default function ServiceDetailPage() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { user, profile, createBooking } = useAuth();

  const service = SERVICES.find(s => s.id === serviceId);
  const Icon = SERVICE_ICONS[serviceId];
  const bgColor = SERVICE_COLORS[serviceId];

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookEmail] = useState(user?.email || '');
  const [bookPhone, setBookPhone] = useState(profile?.phone || '');
  const [city, setCity] = useState(profile?.city || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showSupport, setShowSupport] = useState(false);

  const SUPPORT_PHONE = '9599390188';

  if (!service) {
    return (
      <div className="detail-page">
        <div className="detail-not-found">
          <h2>Service not found</h2>
          <button onClick={() => navigate('/services')} className="btn-primary-app">View All Services</button>
        </div>
      </div>
    );
  }

  const handleBooking = async (e) => {
    e.preventDefault();

    if (!bookPhone.trim() || bookPhone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number'); return;
    }
    if (!city.trim()) { setError('Please select your city'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createBooking({
        service_type: service.id,
        email: bookEmail.trim(),
        phone: bookPhone.trim(),
        city: city.trim(),
        notes: notes.trim(),
      });
      setSuccess(true);
      setTimeout(() => navigate('/bookings'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to create booking. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="detail-page">
      <div className="detail-hero" style={{ background: bgColor }}>
        <button className="detail-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <div className="detail-hero-icon">
          {Icon ? <Icon size={48} color="#0F0F0F" /> : <span style={{ fontSize: 48 }}>{service.icon}</span>}
        </div>
        <h1 className="detail-title">{service.name}</h1>
        <p className="detail-price">{service.price}</p>
      </div>

      <div className="detail-content">
        <p className="detail-desc">{service.description}</p>
        <div className="detail-features">
          <h3>What's Included</h3>
          <ul>
            {service.features.map((f, i) => (
              <li key={i}><Check size={16} className="detail-check" /> {f.title} — {f.desc}</li>
            ))}
          </ul>
        </div>
      </div>

      {showBookingForm && (
        <div className="booking-overlay" onClick={(e) => e.target === e.currentTarget && setShowBookingForm(false)}>
          <div className="booking-sheet">
            {success ? (
              <div className="booking-success">
                <CheckCircle2 size={56} color="#34D399" />
                <h3>Booking Confirmed!</h3>
                <p>We'll contact you shortly to finalize details.</p>
                <p className="booking-success-redirect">Redirecting to bookings...</p>
              </div>
            ) : (
              <>
                <h3 className="booking-sheet-title">Book {service.name}</h3>
                <form onSubmit={handleBooking} className="booking-form">
                  <div className="booking-field">
                    <label><Mail size={14} /> Email *</label>
                    <input type="email" value={bookEmail} readOnly className="input-locked" />
                  </div>
                  <div className="booking-field">
                    <label><Phone size={14} /> Mobile Number *</label>
                    <input type="tel" value={bookPhone} onChange={e => setBookPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" required />
                  </div>
                  <div className="booking-field">
                    <label><MapPin size={14} /> City *</label>
                    <select value={city} onChange={e => setCity(e.target.value)} required>
                      <option value="">Select your city</option>
                      <option value="Delhi NCR">Delhi NCR</option>
                      <option value="Mumbai">Mumbai</option>
                      <option value="Bangalore">Bangalore</option>
                      <option value="Hyderabad">Hyderabad</option>
                      <option value="Chennai">Chennai</option>
                      <option value="Pune">Pune</option>
                      <option value="Kolkata">Kolkata</option>
                    </select>
                  </div>
                  <div className="booking-field">
                    <label><FileText size={14} /> Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Any specific requirements..."
                      rows={3}
                    />
                  </div>
                  {error && <p className="booking-error">{error}</p>}
                  <button type="submit" className="btn-primary-app booking-submit" disabled={submitting}>
                    {submitting ? <><Loader2 size={18} className="spin" /> Booking...</> : 'Confirm Booking'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <div className="detail-cta-bar">
        <button className="detail-support-btn" onClick={() => setShowSupport(true)}>
          <Headphones size={18} />
          Support
        </button>
        <button className="btn-primary-app detail-cta-btn" onClick={() => setShowBookingForm(true)}>
          Book Now — {service.price}
        </button>
      </div>

      {/* Support popup */}
      {showSupport && (
        <div className="support-overlay" onClick={() => setShowSupport(false)}>
          <div className="support-popup" onClick={e => e.stopPropagation()}>
            <button className="support-close" onClick={() => setShowSupport(false)}><X size={18} /></button>
            <h3 className="support-title">Contact Support</h3>
            <p className="support-sub">Choose how you'd like to reach us</p>
            <a
              href={`tel:+91${SUPPORT_PHONE}`}
              className="support-option support-call"
            >
              <Phone size={20} />
              <div>
                <span className="support-option-label">Call Us</span>
                <span className="support-option-sub">+91 {SUPPORT_PHONE}</span>
              </div>
            </a>
            <a
              href={`https://wa.me/91${SUPPORT_PHONE}?text=${encodeURIComponent(`Hi MyBuddyMaid, I need help with ${service.name} service. Please assist me.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="support-option support-wa"
            >
              <MessageCircle size={20} />
              <div>
                <span className="support-option-label">WhatsApp</span>
                <span className="support-option-sub">Chat with us instantly</span>
              </div>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
