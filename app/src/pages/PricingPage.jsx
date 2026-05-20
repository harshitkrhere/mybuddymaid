import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { PLAN_DETAILS, RZP_KEY } from '../lib/constants';
import { Crown, Check, Loader2, AlertCircle } from 'lucide-react';

export default function PricingPage() {
  const { user, profile, userPlan, purchasePlan, refreshUserPlan } = useAuth();

  const [purchasing, setPurchasing] = useState(null);
  const [payError, setPayError] = useState('');

  // Contact fields for plan purchase
  const [buyEmail, setBuyEmail] = useState(profile?.email || user?.email || '');
  const [buyPhone, setBuyPhone] = useState(profile?.phone || '');
  const [contactError, setContactError] = useState('');

  const activePlanDetails = userPlan ? PLAN_DETAILS[userPlan.plan_name] : null;

  const handleBuyPlan = (planKey) => {
    const plan = PLAN_DETAILS[planKey];
    if (!plan || !window.Razorpay) {
      setPayError('Payment service unavailable. Please try again later.');
      return;
    }

    if (!buyEmail.trim() || !buyPhone.trim()) {
      setContactError('Please enter your email and mobile number before purchasing.');
      return;
    }
    if (buyPhone.replace(/\D/g, '').length < 10) {
      setContactError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setPurchasing(planKey);
    setPayError('');
    setContactError('');

    const options = {
      key: RZP_KEY,
      amount: plan.pricePaise,
      currency: 'INR',
      name: 'MyBuddyMaid',
      description: `${plan.name} Package — ${plan.duration} days`,
      image: '/logo.png',
      prefill: {
        name: profile?.full_name || '',
        email: buyEmail,
        contact: buyPhone,
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
            email: buyEmail.trim(),
            phone: buyPhone.trim(),
          });
          await refreshUserPlan();
          setPurchasing(null);

          // Send confirmation email (fire-and-forget)
          supabase.functions.invoke('send-plan-email', {
            body: {
              user_email: buyEmail,
              user_name: profile?.full_name || 'Valued Customer',
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

  return (
    <div className="pricing-page">
      <h1 className="pricing-title">Pricing Plans</h1>
      <p className="pricing-subtitle">Get replacement guarantees, verified profiles, and priority support</p>

      {/* Active plan card */}
      {userPlan && activePlanDetails && (
        <div className="plan-active-card" style={{ borderColor: activePlanDetails.color + '40', marginBottom: 28 }}>
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
      )}

      {/* Contact fields before purchase */}
      {!userPlan && (
        <div className="pricing-contact">
          <div className="booking-field">
            <label>📧 Email *</label>
            <input
              type="email"
              value={buyEmail}
              onChange={e => setBuyEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="booking-field">
            <label>📱 Mobile Number *</label>
            <input
              type="tel"
              value={buyPhone}
              onChange={e => setBuyPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              required
            />
          </div>
          {contactError && <p className="booking-error">{contactError}</p>}
        </div>
      )}

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
              disabled={purchasing !== null || !!userPlan}
            >
              {purchasing === key ? <><Loader2 size={16} className="spin" /> Processing...</> : `Get ${plan.name} — ₹${plan.price.toLocaleString()}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
