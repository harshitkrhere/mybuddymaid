"use client";
// NOTE: robots noindex for this route is set by proxy.ts (X-Robots-Tag) because a
// client component cannot export metadata.

// No React hooks needed anymore
import { 
  Wrench, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  Mail, 
  Phone, 
  Send, 
  ShieldCheck
} from 'lucide-react';
import { MAINTENANCE_CONFIG } from '../../lib/maintenance';

export default function MaintenancePage() {

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

          {/* Prominent WhatsApp Contact CTA */}
          <div className="maint-notify-box" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="maint-notify-heading" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Need Immediate Services?
            </div>
            <div className="maint-notify-sub" style={{ fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              Contact us directly for fast, professional maid matching and booking assistance while our systems upgrade.
            </div>
            
            <a 
              href={MAINTENANCE_CONFIG.emergencyContact.whatsapp} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="maint-notify-btn"
              style={{ display: 'inline-flex', padding: '0.875rem 2rem', fontSize: '1rem', margin: '0 auto' }}
            >
              <Send size={18} /> Message us on WhatsApp
            </a>
            <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-inverse-muted)' }}>
              Or call us directly at <strong>{MAINTENANCE_CONFIG.emergencyContact.phone}</strong>
            </div>
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


      </div>
    </div>
  );
}
