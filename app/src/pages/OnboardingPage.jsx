import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CITIES } from '../lib/serviceability';
import { User, Phone, Mail, MapPin, ArrowRight, Loader2, Home as HomeIcon } from 'lucide-react';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('');
  const authEmail = user?.email || '';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) { setError('Please enter your name'); return; }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number'); return;
    }

    if (!state) { setError('Please select your state'); return; }

    setSaving(true);
    setError('');
    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: authEmail,
        city: state,
      });
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-icon">
          <HomeIcon size={28} />
        </div>
        <h1 className="onboarding-title">Set up your profile</h1>
        <p className="onboarding-subtitle">Just a few details to get started.</p>

        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="onboarding-field">
            <label><User size={14} /> Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="What should we call you?"
              autoFocus
            />
          </div>

          <div className="onboarding-field">
            <label><Phone size={14} /> Mobile Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
            />
          </div>

          <div className="onboarding-field">
            <label><Mail size={14} /> Email</label>
            <input
              type="email"
              value={authEmail}
              readOnly
              className="input-locked"
            />
          </div>

          <div className="onboarding-field">
            <label><MapPin size={14} /> City</label>
            <select value={state} onChange={e => setState(e.target.value)}>
              <option value="">Select your city</option>
              {CITIES.map(c => <option key={c.slug} value={c.name}>{c.name}</option>)}
              {/* keep a previously saved value selectable even if it is not a served city */}
              {state && !CITIES.some(c => c.name === state) && <option value={state}>{state}</option>}
            </select>
          </div>

          {error && <p className="onboarding-error">{error}</p>}

          <button type="submit" className="btn-primary-app onboarding-submit" disabled={saving}>
            {saving ? <><Loader2 size={18} className="spin" /> Saving...</> : <>Continue <ArrowRight size={18} /></>}
          </button>

          <p className="onboarding-hint">You can change these later in your profile settings.</p>
        </form>
      </div>
    </div>
  );
}
