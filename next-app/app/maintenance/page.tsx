"use client";

import { useState, useEffect } from 'react';
import { 
  Wrench, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  Mail, 
  Phone, 
  Send, 
  ShieldCheck, 
  Lock, 
  Unlock,
  AlertCircle
} from 'lucide-react';
import { MAINTENANCE_CONFIG } from '../../lib/maintenance';

export default function MaintenancePage() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [bypassed, setBypassed] = useState(false);

  useEffect(() => {
    // Check if bypass cookie exists on mount
    setBypassed(document.cookie.includes('maintenance_bypass=true'));
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubscribed(true);
    }, 800);
  };

  const handleToggleBypass = () => {
    const nextState = !bypassed;
    if (nextState) {
      document.cookie = "maintenance_bypass=true; path=/; max-age=86400"; // 1 day
    } else {
      document.cookie = "maintenance_bypass=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    setBypassed(nextState);
    window.location.href = '/home';
  };

  return (
    <div className="maint-page">
      <div className="maint-glow-bg" />

      <div className="maint-content">
        {/* Brand Header */}
        <div className="maint-brand">
          <div className="maint-logo-icon">
            <Sparkles size={24} />
          </div>
          <span className="maint-brand-name">MyBuddyMaid</span>
        </div>

        {/* Live Status Badge */}
        <div className="maint-badge">
          <span className="maint-badge-dot" />
          <span>Scheduled System Upgrade</span>
        </div>

        {/* Glass Main Card */}
        <div className="maint-card">
          <h1 className="maint-title">
            We're Making <span>MyBuddyMaid</span> Better!
          </h1>
          <p className="maint-subtitle">
            {MAINTENANCE_CONFIG.subtitle}
          </p>


          {/* Upgrade Progress Bar */}
          <div className="maint-progress-wrap">
            <div className="maint-progress-header">
              <span className="maint-progress-title">
                <Wrench size={16} color="#34D399" /> Overall Infrastructure Progress
              </span>
              <span className="maint-progress-percent">{MAINTENANCE_CONFIG.progressPercent}%</span>
            </div>
            <div className="maint-progress-track">
              <div 
                className="maint-progress-fill" 
                style={{ width: `${MAINTENANCE_CONFIG.progressPercent}%` }}
              />
            </div>
          </div>

          {/* Subsystem Readiness Checklist */}
          <div className="maint-subsystems">
            <div className="maint-subsystems-title">
              <ShieldCheck size={16} color="#34D399" /> Component Upgrade Status
            </div>
            <div className="maint-subsystem-list">
              {MAINTENANCE_CONFIG.subsystems.map((sub, idx) => (
                <div key={idx} className="maint-subsystem-item">
                  <div className={`maint-subsystem-icon ${sub.status}`}>
                    {sub.status === 'completed' && <CheckCircle2 size={16} />}
                    {sub.status === 'in-progress' && <RefreshCw size={16} />}
                    {sub.status === 'pending' && <Clock size={16} />}
                  </div>
                  <div className="maint-subsystem-info">
                    <span className="maint-subsystem-name">{sub.name}</span>
                    <span className="maint-subsystem-label">{sub.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subscribe for Notification */}
          <div className="maint-notify-box">
            <div className="maint-notify-heading">Get Notified When We're Back Online</div>
            <div className="maint-notify-sub">Enter your email to receive an instant message the second our services resume.</div>
            
            {subscribed ? (
              <div className="maint-success-msg">
                <CheckCircle2 size={18} /> You're on the priority notification list! We'll ping you immediately upon launch.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="maint-notify-form">
                <input
                  type="email"
                  placeholder="Enter your email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="maint-notify-input"
                />
                <button type="submit" className="maint-notify-btn" disabled={submitting}>
                  {submitting ? 'Registering...' : (
                    <>
                      Notify Me <Send size={15} />
                    </>
                  )}
                </button>
              </form>
            )}
            {errorMsg && (
              <div style={{ color: '#EF4444', fontSize: '0.78rem', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <AlertCircle size={14} /> {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* Emergency Assistance Links */}
        <div className="maint-contacts">
          <a href={`tel:${MAINTENANCE_CONFIG.emergencyContact.phone}`} className="maint-contact-link">
            <Phone size={14} /> Urgent Booking Assistance
          </a>
          <a href={MAINTENANCE_CONFIG.emergencyContact.whatsapp} target="_blank" rel="noopener noreferrer" className="maint-contact-link">
            <Send size={14} /> WhatsApp Support
          </a>
          <a href={`mailto:${MAINTENANCE_CONFIG.emergencyContact.email}`} className="maint-contact-link">
            <Mail size={14} /> Email Desk
          </a>
        </div>

        {/* Floating Admin Bypass Switch for testing */}
        <div className="maint-admin-floating">
          {bypassed ? <Unlock size={14} color="#34D399" /> : <Lock size={14} color="#94A3B8" />}
          <span>Admin Preview Mode: {bypassed ? 'ENABLED' : 'DISABLED'}</span>
          <button onClick={handleToggleBypass}>
            {bypassed ? 'Re-enable Maintenance' : 'Bypass & View Site'}
          </button>
        </div>
      </div>
    </div>
  );
}
