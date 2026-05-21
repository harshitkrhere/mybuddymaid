import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { PLAN_DETAILS, RZP_KEY } from '../lib/constants';
import {
  Crown, Check, Loader2, AlertCircle, Shield, Clock, Users,
  Star, ChevronRight, Zap, Award, HeartHandshake, Mail, Phone,
  Sparkles
} from 'lucide-react';

const TESTIMONIALS = [
  {
    name: 'Priya Sharma',
    role: 'Working Professional',
    city: 'Delhi NCR',
    content: 'Found an amazing full-time maid through MyBuddyMaid within 3 days. The verification process gave us complete peace of mind. Highly recommend!',
    rating: 5,
  },
  {
    name: 'Rajesh Kumar',
    role: 'Business Owner',
    city: 'Bangalore',
    content: 'We needed a cook urgently and the Gold plan delivered 3 verified profiles. Selected one on the same day. Excellent service!',
    rating: 5,
  },
  {
    name: 'Anita Desai',
    role: 'New Mother',
    city: 'Mumbai',
    content: 'The postnatal care helper we got was trained and compassionate. The replacement guarantee gave us confidence to commit.',
    rating: 5,
  },
  {
    name: 'Vikram Singh',
    role: 'IT Manager',
    city: 'Hyderabad',
    content: 'Upgraded from Silver to Platinum for the VIP concierge. Worth every rupee — they handled everything end-to-end.',
    rating: 4,
  },
];

const PLATFORM_FEATURES = [
  'Aadhaar & KYC verified professionals',
  'Police verification on premium plans',
  'Free replacement if unsatisfied',
  'Dedicated relationship manager',
  'Pan-India coverage (7+ cities)',
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
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  const activePlanDetails = userPlan ? PLAN_DETAILS[userPlan.plan_name] : null;
  const plan = PLAN_DETAILS[selectedPlan];

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setTestimonialIdx(prev => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleBuyPlan = (planKey) => {
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

    const options = {
      key: RZP_KEY,
      amount: p.pricePaise,
      currency: 'INR',
      name: 'MyBuddyMaid',
      description: `${p.name} Package — ${p.duration} days`,
      image: '/logo.png',
      prefill: { name: profile?.full_name || '', email: buyEmail, contact: buyPhone },
      theme: { color: '#34D399' },
      handler: async (response) => {
        try {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + p.duration);
          await purchasePlan({
            plan_name: planKey,
            amount_paid: p.pricePaise,
            razorpay_payment_id: response.razorpay_payment_id,
            replacements_total: p.replacementsTotal,
            expires_at: expiresAt.toISOString(),
            email: buyEmail.trim(),
            phone: buyPhone.trim(),
          });
          await refreshUserPlan();
          setPurchasing(null);
          supabase.functions.invoke('send-plan-email', {
            body: {
              user_email: buyEmail,
              user_name: profile?.full_name || 'Valued Customer',
              plan_name: planKey,
              amount_paid: p.pricePaise,
              payment_id: response.razorpay_payment_id,
            },
          }).catch(err => console.warn('Email send failed:', err));
        } catch (err) {
          setPayError('Payment recorded but plan activation failed. Contact support.');
          setPurchasing(null);
        }
      },
      modal: { ondismiss: () => setPurchasing(null) },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => { setPayError('Payment failed.'); setPurchasing(null); });
      rzp.open();
    } catch (err) {
      setPayError('Could not open payment gateway.');
      setPurchasing(null);
    }
  };

  const testimonial = TESTIMONIALS[testimonialIdx];

  return (
    <div className="pricing-page">
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
                {plan.duration}-day coverage with {plan.replacementsTotal} replacement{plan.replacementsTotal > 1 ? 's' : ''}
              </p>

              <div className="pricing-card-price">
                <span className="pricing-card-amount">₹{plan.price.toLocaleString()}</span>
                <span className="pricing-card-period">one-time</span>
              </div>

              <div className="pricing-card-benefits">
                <div className="pricing-benefit">
                  <Shield size={16} />
                  <span>{plan.duration}-day replacement guarantee</span>
                </div>
                <div className="pricing-benefit">
                  <Users size={16} />
                  <span>{plan.profiles} verified profile{plan.profiles > 1 ? 's' : ''}</span>
                </div>
                <div className="pricing-benefit">
                  <Clock size={16} />
                  <span>Valid for {plan.duration} days</span>
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

            {/* Right column — Features + testimonial */}
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

              {/* Testimonial */}
              <div className="pricing-testimonial">
                <div className="pricing-testimonial-content" key={testimonialIdx}>
                  <div className="pricing-testimonial-header">
                    <div className="pricing-testimonial-avatar">
                      {testimonial.name[0]}
                    </div>
                    <div className="pricing-testimonial-info">
                      <span className="pricing-testimonial-name">{testimonial.name}</span>
                      <span className="pricing-testimonial-role">{testimonial.role}, {testimonial.city}</span>
                    </div>
                    <div className="pricing-testimonial-stars">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} size={12} fill="currentColor" />
                      ))}
                    </div>
                  </div>
                  <p className="pricing-testimonial-text">"{testimonial.content}"</p>
                </div>
                <div className="pricing-testimonial-dots">
                  {TESTIMONIALS.map((_, i) => (
                    <button
                      key={i}
                      className={`pricing-dot ${i === testimonialIdx ? 'active' : ''}`}
                      onClick={() => setTestimonialIdx(i)}
                    />
                  ))}
                </div>
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
                <div className="pricing-compare-meta">{p.duration} days • {p.replacementsTotal} replacement{p.replacementsTotal > 1 ? 's' : ''}</div>
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
