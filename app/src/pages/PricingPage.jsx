import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { PLAN_DETAILS } from '../lib/constants';
import {
  Crown, Check, Loader2, AlertCircle, Shield, Clock, Users,
  ChevronRight, Zap, Award, HeartHandshake, Mail, Phone,
  Sparkles, MessageCircle, X, PhoneCall
} from 'lucide-react';

// ── TEMPORARY: Set to true to pause purchases ──
const PURCHASES_PAUSED = true;
const SUPPORT_PHONE = '+919355114869';
const SUPPORT_WHATSAPP = `https://wa.me/919355114869?text=${encodeURIComponent('Hi MyBuddyMaid! I\'m interested in purchasing a package. Please help me with the details.')}`;

// Testimonials removed: the three entries here were invented names with 5-star
// ratings. We publish real reviews or none at all.
const PLATFORM_FEATURES = [
  'Aadhaar & KYC verified professionals',
  'Police verification on premium plans',
  'Free replacement if unsatisfied',
  'Dedicated relationship manager',
  'Coverage across Delhi NCR, Mumbai, Pune, Bangalore & Mangalore',
  '24/7 support via WhatsApp',
  'Secure Razorpay payments',
  'No hidden charges — ever',
];

export default function PricingPage() {
  const { user, profile, userPlan, purchasePlan, refreshUserPlan } = useAuth();
  const [purchasing, setPurchasing] = useState(null);
  const [payError, setPayError] = useState('');
  const buyEmail = user?.email || '';
  const [buyPhone, setBuyPhone] = useState(profile?.phone || '');
  const [contactError, setContactError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('gold');
  const [showPausedModal, setShowPausedModal] = useState(false);
  const [pausedPlanName, setPausedPlanName] = useState('');

  const activePlanDetails = userPlan ? PLAN_DETAILS[userPlan.plan_name] : null;
  const plan = PLAN_DETAILS[selectedPlan];

  const handleBuyPlan = async (planKey) => {
    // ── TEMPORARY PAUSE: Show contact modal instead of payment ──
    if (PURCHASES_PAUSED) {
      const p = PLAN_DETAILS[planKey];
      setPausedPlanName(p?.name || planKey);
      setShowPausedModal(true);
      return;
    }

    const p = PLAN_DETAILS[planKey];
    if (!p || !window.Razorpay) {
      setPayError('Payment service unavailable. Please try again later.');
      return;
    }
    if (!buyPhone.trim()) {
      setContactError('Please enter your mobile number before purchasing.');
      return;
    }
    if (buyPhone.replace(/\D/g, '').length < 10) {
      setContactError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setPurchasing(planKey);
    setPayError('');
    setContactError('');

    try {
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        {
          body: {
            plan_name: planKey,
            email: buyEmail.trim(),
            phone: buyPhone.trim(),
          },
        },
      );

      if (orderError || !orderData?.order_id) {
        setPayError(orderData?.error || 'Failed to create payment order. Please try again.');
        setPurchasing(null);
        return;
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'MyBuddyMaid',
        description: `${orderData.plan_display_name} Package — ${orderData.plan_duration} days`,
        image: '/logo.png',
        order_id: orderData.order_id,
        prefill: { name: profile?.full_name || '', email: buyEmail, contact: buyPhone },
        theme: { color: '#34D399' },
        handler: async (response) => {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              'verify-razorpay-payment',
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  plan_name: planKey,
                  email: buyEmail.trim(),
                  phone: buyPhone.trim(),
                },
              },
            );

            if (verifyError || !verifyData?.success) {
              setPayError(verifyData?.error || 'Payment verification failed. Contact support if amount was deducted.');
              setPurchasing(null);
              return;
            }

            await refreshUserPlan();
            setPurchasing(null);

            supabase.functions.invoke('send-package-email', {
              body: {
                user_id: user?.id,
                user_name: profile?.full_name || 'Valued Customer',
                user_email: buyEmail,
                plan_name: planKey,
                amount_paid: orderData.amount,
                razorpay_payment_id: response.razorpay_payment_id,
                purchased_at: new Date().toISOString(),
                replacements_total: p.replacementsTotal,
                expires_at: verifyData.plan?.expires_at || new Date().toISOString(),
              },
            }).catch(() => {});
          } catch {
            setPayError('Payment recorded but plan activation failed. Contact support.');
            setPurchasing(null);
          }
        },
        modal: { ondismiss: () => setPurchasing(null) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => { setPayError('Payment failed.'); setPurchasing(null); });
      rzp.open();
    } catch {
      setPayError('Could not initiate payment. Please try again.');
      setPurchasing(null);
    }
  };


  return (
    <div className="pricing-page">

      {/* ── Purchases Paused Modal ── */}
      {showPausedModal && (
        <div className="paused-modal-overlay" onClick={() => setShowPausedModal(false)}>
          <div className="paused-modal" onClick={e => e.stopPropagation()}>
            <button className="paused-modal-close" onClick={() => setShowPausedModal(false)}>
              <X size={20} />
            </button>

            <div className="paused-modal-icon">
              <Shield size={32} />
            </div>

            <h2 className="paused-modal-title">Online Purchases Temporarily on Hold</h2>

            <p className="paused-modal-desc">
              We're upgrading our systems to serve you better. To purchase the
              <strong> {pausedPlanName}</strong> package, please reach out to our team directly — we'll get you set up instantly.
            </p>

            <div className="paused-modal-actions">
              <a
                href={SUPPORT_WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="paused-modal-btn paused-btn-whatsapp"
              >
                <MessageCircle size={20} />
                <div>
                  <span className="paused-btn-label">Chat on WhatsApp</span>
                  <span className="paused-btn-sub">Instant response · Available 24/7</span>
                </div>
              </a>

              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="paused-modal-btn paused-btn-phone"
              >
                <PhoneCall size={20} />
                <div>
                  <span className="paused-btn-label">Call Us Now</span>
                  <span className="paused-btn-sub">+91 93184 29135 · Mon–Sun 9AM–9PM</span>
                </div>
              </a>
            </div>

            <p className="paused-modal-footer">
              We apologise for the inconvenience. Our team is ready to assist you personally.
            </p>
          </div>
        </div>
      )}
      {/* Hero section */}
      <div className="pricing-hero">
        <div className="pricing-hero-badge">
          <Crown size={14} />
          <span>Simple, Transparent Pricing</span>
        </div>
        <h1 className="pricing-hero-title">Choose Your Perfect Plan</h1>
        <p className="pricing-hero-sub">
          Get verified domestic help with replacement guarantees. One payment, complete peace of mind.
        </p>
      </div>

      {/* Active plan banner */}
      {userPlan && activePlanDetails && (
        <div className="pricing-active-banner" style={{ borderColor: activePlanDetails.color + '40' }}>
          <div className="pricing-active-badge" style={{ background: activePlanDetails.gradient }}>
            {activePlanDetails.emoji} {activePlanDetails.name} Plan — Active
          </div>
          <div className="pricing-active-meta">
            <span>Expires {new Date(userPlan.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span>•</span>
            <span>{userPlan.replacements_total - userPlan.replacements_used} replacements left</span>
          </div>
        </div>
      )}

      {/* Plan selector tabs */}
      {!userPlan && (
        <div className="pricing-selector">
          {Object.entries(PLAN_DETAILS).map(([key, p]) => (
            <button
              key={key}
              className={`pricing-selector-tab ${selectedPlan === key ? 'active' : ''}`}
              onClick={() => setSelectedPlan(key)}
              style={selectedPlan === key ? { borderColor: p.color, color: p.color } : {}}
            >
              <span className="pricing-selector-emoji">{p.emoji}</span>
              <span className="pricing-selector-name">{p.name}</span>
              {p.popular && <span className="pricing-selector-pop">Popular</span>}
            </button>
          ))}
        </div>
      )}

      {/* Main pricing card */}
      {!userPlan && plan && (
        <div className="pricing-card" style={{ '--plan-color': plan.color }}>
          {plan.popular && <div className="pricing-card-ribbon">Most Popular</div>}

          <div className="pricing-card-inner">
            {/* Left column — Price & benefits */}
            <div className="pricing-card-left">
              <div className="pricing-card-badge" style={{ background: plan.color + '18', color: plan.color }}>
                <Award size={14} />
                <span>{plan.name} Package</span>
              </div>

              <h2 className="pricing-card-plan-name">{plan.emoji} {plan.name} Plan</h2>
              <p className="pricing-card-plan-sub">
                {plan.durationLabel} coverage with {plan.replacementsTotal} replacement{plan.replacementsTotal > 1 ? 's' : ''}
              </p>

              <div className="pricing-card-price">
                <span className="pricing-card-amount">₹{plan.price.toLocaleString()}</span>
                <span className="pricing-card-period">one-time</span>
              </div>

              <div className="pricing-card-benefits">
                <div className="pricing-benefit">
                  <Shield size={16} />
                  <span>{plan.durationLabel} replacement guarantee</span>
                </div>
                <div className="pricing-benefit">
                  <Users size={16} />
                  <span>{plan.profiles} verified profile{plan.profiles > 1 ? 's' : ''}</span>
                </div>
                <div className="pricing-benefit">
                  <Clock size={16} />
                  <span>Valid for {plan.durationLabel}</span>
                </div>
                <div className="pricing-benefit">
                  <HeartHandshake size={16} />
                  <span>Satisfaction guaranteed</span>
                </div>
              </div>

              {/* Contact fields */}
              <div className="pricing-card-contact">
                <div className="pricing-input-row">
                  <Mail size={16} />
                  <input
                    type="email"
                    value={buyEmail}
                    readOnly
                    className="input-locked"
                  />
                </div>
                <div className="pricing-input-row">
                  <Phone size={16} />
                  <input
                    type="tel"
                    value={buyPhone}
                    onChange={e => setBuyPhone(e.target.value)}
                    placeholder="+91 mobile number"
                  />
                </div>
                {contactError && <p className="pricing-field-error">{contactError}</p>}
              </div>

              <button
                className="pricing-card-cta"
                style={{ background: plan.gradient }}
                onClick={() => handleBuyPlan(selectedPlan)}
                disabled={purchasing !== null || !!userPlan}
              >
                {purchasing === selectedPlan ? (
                  <><Loader2 size={18} className="spin" /> Processing...</>
                ) : (
                  <>
                    <Zap size={18} />
                    Get {plan.name} — ₹{plan.price.toLocaleString()}
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </div>

            {/* Right column — platform features */}
            <div className="pricing-card-right">
              <div className="pricing-features-header">
                <Sparkles size={16} />
                <h3>What's Included</h3>
              </div>

              <div className="pricing-features-list">
                {plan.benefits.map((b, i) => (
                  <div key={i} className="pricing-feature-item" style={{ animationDelay: `${i * 0.07}s` }}>
                    <div className="pricing-feature-dot" style={{ background: plan.color + '20' }}>
                      <Check size={12} style={{ color: plan.color }} />
                    </div>
                    <span>{b}</span>
                  </div>
                ))}
                <div className="pricing-features-divider"></div>
                <div className="pricing-features-subheader">Platform Benefits</div>
                {PLATFORM_FEATURES.map((f, i) => (
                  <div key={i} className="pricing-feature-item" style={{ animationDelay: `${(plan.benefits.length + i) * 0.07}s` }}>
                    <div className="pricing-feature-dot" style={{ background: plan.color + '20' }}>
                      <Check size={12} style={{ color: plan.color }} />
                    </div>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      )}

      {payError && (
        <div className="pricing-error">
          <AlertCircle size={16} /> {payError}
        </div>
      )}

      {/* Compare all plans */}
      {!userPlan && (
        <div className="pricing-compare">
          <h2 className="pricing-compare-title">Compare All Plans</h2>
          <div className="pricing-compare-grid">
            {Object.entries(PLAN_DETAILS).map(([key, p]) => (
              <button
                key={key}
                className={`pricing-compare-card ${selectedPlan === key ? 'selected' : ''}`}
                onClick={() => { setSelectedPlan(key); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                style={selectedPlan === key ? { borderColor: p.color } : {}}
              >
                {p.popular && <span className="pricing-compare-pop">Popular</span>}
                <span className="pricing-compare-emoji">{p.emoji}</span>
                <h4>{p.name}</h4>
                <div className="pricing-compare-price">₹{p.price.toLocaleString()}</div>
                <div className="pricing-compare-meta">{p.durationLabel} • {p.replacementsTotal} replacement{p.replacementsTotal > 1 ? 's' : ''}</div>
                <ul className="pricing-compare-benefits">
                  {p.benefits.map((b, i) => (
                    <li key={i}><Check size={12} style={{ color: p.color }} /> {b}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
