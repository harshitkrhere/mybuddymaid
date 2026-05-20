import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { PLAN_DETAILS, RZP_KEY } from '../lib/constants';
import { User, Phone, Mail, MapPin, LogOut, Check, Crown, Loader2, AlertCircle } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, userPlan, signOut, updateProfile, purchasePlan, refreshUserPlan } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'packages' ? 'packages' : 'profile');

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');
  const [city, setCity] = useState(profile?.city || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [purchasing, setPurchasing] = useState(null);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setEmail(profile.email || user?.email || '');
      setCity(profile.city || '');
    }
  }, [profile, user]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'packages') setActiveTab('packages');
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'packages' ? { tab: 'packages' } : {});
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      await updateProfile({ full_name: fullName, phone, email, city });
      setSaveMsg('Profile saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg('Error saving: ' + (err.message || 'Please try again'));
    } finally {
      setSaving(false);
    }
  };

  const handleBuyPlan = (planKey) => {
    const plan = PLAN_DETAILS[planKey];
    if (!plan || !window.Razorpay) {
      setPayError('Payment service unavailable. Please try again later.');
      return;
    }

    setPurchasing(planKey);
    setPayError('');

    const options = {
      key: RZP_KEY,
      amount: plan.pricePaise,
      currency: 'INR',
      name: 'MyBuddyMaid',
      description: `${plan.name} Package — ${plan.duration} days`,
      image: '/logo.png',
      prefill: {
        name: fullName || profile?.full_name || '',
        email: email || user?.email || '',
        contact: phone || profile?.phone || '',
      },
      theme: { color: '#34D399' },
      handler: async (response) => {
        try {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + plan.duration);

          await purchasePlan({
            plan_name: planKey,
            amount_paid: plan.pricePaise,
            razorpay_payment_id: response.razorpay_payment_id,
            replacements_total: plan.replacementsTotal,
            expires_at: expiresAt.toISOString(),
          });
          await refreshUserPlan();
          setPurchasing(null);

          // Send confirmation email (fire-and-forget, don't block UI)
          supabase.functions.invoke('send-plan-email', {
            body: {
              user_email: email || user?.email,
              user_name: fullName || profile?.full_name || 'Valued Customer',
              plan_name: planKey,
              amount_paid: plan.pricePaise,
              payment_id: response.razorpay_payment_id,
            },
          }).catch(err => console.warn('Email send failed:', err));

        } catch (err) {
          setPayError('Payment recorded but plan activation failed. Contact support.');
          setPurchasing(null);
        }
      },
      modal: {
        ondismiss: () => setPurchasing(null),
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        setPayError('Payment failed. Please try again.');
        setPurchasing(null);
      });
      rzp.open();
    } catch (err) {
      setPayError('Could not open payment gateway.');
      setPurchasing(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const activePlanDetails = userPlan ? PLAN_DETAILS[userPlan.plan_name] : null;
  const initials = (profile?.full_name || user?.email || '?')[0].toUpperCase();

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar" style={{ background: activePlanDetails?.gradient || 'var(--clr-primary)' }}>
          {initials}
        </div>
        <h2 className="profile-name">{profile?.full_name || 'Set your name'}</h2>
        <p className="profile-email">{user?.email || profile?.phone || ''}</p>
      </div>

      <div className="profile-tabs">
        <button
          className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => handleTabChange('profile')}
        >
          <User size={16} /> My Profile
        </button>
        <button
          className={`profile-tab ${activeTab === 'packages' ? 'active' : ''}`}
          onClick={() => handleTabChange('packages')}
        >
          <Crown size={16} /> My Plan
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="profile-tab-content">
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
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="profile-field">
              <label><MapPin size={14} /> City</label>
              <select value={city} onChange={e => setCity(e.target.value)}>
                <option value="">Select city</option>
                <option value="Delhi NCR">Delhi NCR</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Bangalore">Bangalore</option>
                <option value="Hyderabad">Hyderabad</option>
                <option value="Chennai">Chennai</option>
                <option value="Pune">Pune</option>
                <option value="Kolkata">Kolkata</option>
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
      )}

      {activeTab === 'packages' && (
        <div className="profile-tab-content">
          {userPlan && activePlanDetails ? (
            <div className="plan-active-card" style={{ borderColor: activePlanDetails.color + '40' }}>
              <div className="plan-active-header">
                <span className="plan-active-badge" style={{ background: activePlanDetails.gradient }}>
                  {activePlanDetails.emoji} {activePlanDetails.name} Plan
                </span>
                <span className="plan-active-status">✓ Active</span>
              </div>
              <div className="plan-active-info">
                <div className="plan-info-row">
                  <span>Purchased</span>
                  <strong>{new Date(userPlan.purchased_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                </div>
                <div className="plan-info-row">
                  <span>Expires</span>
                  <strong>{new Date(userPlan.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                </div>
                <div className="plan-info-row">
                  <span>Replacements</span>
                  <strong>{userPlan.replacements_used} of {userPlan.replacements_total} used</strong>
                </div>
                <div className="plan-replacements-bar">
                  <div
                    className="plan-replacements-fill"
                    style={{
                      width: `${((userPlan.replacements_total - userPlan.replacements_used) / userPlan.replacements_total) * 100}%`,
                      background: activePlanDetails.gradient,
                    }}
                  ></div>
                </div>
              </div>
              <div className="plan-active-benefits">
                <h4>Your Benefits</h4>
                <ul>
                  {activePlanDetails.benefits.map((b, i) => (
                    <li key={i}><Check size={14} style={{ color: activePlanDetails.color }} /> {b}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <>
              <div className="packages-intro">
                <Crown size={24} />
                <h3>Choose Your Plan</h3>
                <p>Get replacement guarantees, verified profiles, and priority support</p>
              </div>

              {payError && (
                <div className="packages-error">
                  <AlertCircle size={16} /> {payError}
                </div>
              )}

              <div className="packages-grid">
                {Object.entries(PLAN_DETAILS).map(([key, plan]) => (
                  <div key={key} className={`package-card ${plan.popular ? 'popular' : ''}`}>
                    {plan.popular && <span className="package-popular">Most Popular</span>}
                    <div className="package-header">
                      <span className="package-emoji">{plan.emoji}</span>
                      <h3>{plan.name}</h3>
                      <div className="package-price">
                        <span className="package-amount">₹{plan.price.toLocaleString()}</span>
                        <span className="package-duration">{plan.duration} days</span>
                      </div>
                    </div>
                    <ul className="package-benefits">
                      {plan.benefits.map((b, i) => (
                        <li key={i}><Check size={14} style={{ color: plan.color }} /> {b}</li>
                      ))}
                    </ul>
                    <button
                      className="btn-primary-app package-buy"
                      style={{ background: plan.gradient }}
                      onClick={() => handleBuyPlan(key)}
                      disabled={purchasing !== null}
                    >
                      {purchasing === key ? <><Loader2 size={16} className="spin" /> Processing...</> : `Get ${plan.name} — ₹${plan.price.toLocaleString()}`}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
