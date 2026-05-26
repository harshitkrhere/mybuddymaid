import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { INDIAN_STATES } from '../lib/constants';
import { User, Phone, Mail, MapPin, LogOut, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, signOut, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [state, setState] = useState(profile?.city || '');
  const authEmail = user?.email || '';
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setState(profile.city || '');
    }
  }, [profile, user]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      await updateProfile({ full_name: fullName, phone, email: authEmail, city: state });
      setSaveMsg('Profile saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg('Error saving: ' + (err.message || 'Please try again'));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const initials = (profile?.full_name || user?.email || '?')[0].toUpperCase();

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar" style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}>
          {initials}
        </div>
        <h2 className="profile-name">{profile?.full_name || 'Set your name'}</h2>
        <p className="profile-email">{user?.email || profile?.phone || ''}</p>
      </div>

      <form onSubmit={handleSaveProfile} className="profile-form">
        <div className="profile-field">
          <label><User size={14} /> Full Name</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
        </div>
        <div className="profile-field">
          <label><Phone size={14} /> Phone</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
        </div>
        <div className="profile-field">
          <label><Mail size={14} /> Email</label>
          <input type="email" value={authEmail} readOnly className="input-locked" />
        </div>
        <div className="profile-field">
          <label><MapPin size={14} /> State</label>
          <select value={state} onChange={e => setState(e.target.value)}>
            <option value="">Select state</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary-app profile-save" disabled={saving}>
          {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : 'Save Profile'}
        </button>
        {saveMsg && <p className={`profile-save-msg ${saveMsg.includes('Error') ? 'error' : ''}`}>{saveMsg}</p>}
      </form>

      <button className="profile-signout" onClick={handleSignOut}>
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  );
}
