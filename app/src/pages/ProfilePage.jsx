import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { INDIAN_STATES } from '../lib/constants';
import { User, Phone, Mail, MapPin, LogOut, Loader2, Trash2, AlertTriangle } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, signOut, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [state, setState] = useState(profile?.city || '');
  const authEmail = user?.email || '';
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      setSaveMsg('Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    setDeleteError('');
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { confirm: 'DELETE_MY_ACCOUNT' },
      });
      if (error || !data?.success) {
        setDeleteError(data?.message || 'Deletion failed. Please contact support.');
        setDeleting(false);
        return;
      }
      // Account deleted — sign out and redirect
      await signOut();
    } catch {
      setDeleteError('Something went wrong. Please contact support.');
      setDeleting(false);
    }
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

      {/* Delete Account — DPDP Act Compliance */}
      <div className="profile-danger-zone">
        {!showDeleteConfirm ? (
          <button
            className="profile-delete-btn"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 size={16} /> Delete My Account
          </button>
        ) : (
          <div className="profile-delete-confirm">
            <div className="profile-delete-warning">
              <AlertTriangle size={18} />
              <span>This will permanently delete all your data including bookings, plans, and profile. This action cannot be undone.</span>
            </div>
            <p className="profile-delete-instruction">Type <strong>DELETE</strong> to confirm:</p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="profile-delete-input"
            />
            {deleteError && <p className="profile-delete-error">{deleteError}</p>}
            <div className="profile-delete-actions">
              <button
                className="profile-delete-cancel"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeleteError(''); }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="profile-delete-confirm-btn"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
              >
                {deleting ? <><Loader2 size={14} className="spin" /> Deleting...</> : 'Permanently Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
