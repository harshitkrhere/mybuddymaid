// supabase/functions/send-booking-email/index.ts
// MyBuddyMaid — Booking Confirmation Email Edge Function
// Sends branded, service-specific confirmation emails via Resend

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Brand Constants ────────────────────────────────────────────────────────────
const BRAND = {
  name: 'MyBuddyMaid',
  tagline: 'Redefining Home Care in India',
  primary: '#0D5C63',
  accent: '#F4A623',
  background: '#FAFAF7',
  dark: '#1A1A2E',
  white: '#ffffff',
  font: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
  supportEmail: 'info@mybuddymaid.in',
  supportPhone: '+91 9599390188',
  website: 'https://mybuddymaid.in',
  fromEmail: 'MyBuddyMaid <noreply@mybuddymaid.in>',
  replyTo: 'info@mybuddymaid.in',
} as const;

// ─── CORS Headers ───────────────────────────────────────────────────────────────
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Types ──────────────────────────────────────────────────────────────────────
type ServiceType = 'part-time' | 'full-time' | 'elderly-care' | 'cook' | 'nanny' | 'postnatal';

interface BookingPayload {
  user_id: string;
  user_name: string;
  user_email: string;
  service_type: ServiceType;
  city: string;
  notes: string;
  booking_id: string;
  created_at: string;
}

interface ServiceVariant {
  subject: string;
  serviceLabel: string;
  emoji: string;
  opening: (name: string) => string;
  context: string;
  steps: string[];
  specialBox: {
    label: string;
    text: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
    labelColor: string;
  };
}

// ─── Supabase Admin Client ──────────────────────────────────────────────────────
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ─── Service Variants ───────────────────────────────────────────────────────────
const SERVICE_VARIANTS: Record<ServiceType, ServiceVariant> = {
  'part-time': {
    subject: 'Booking Confirmed — Your Part-Time Home Helper is Being Arranged 🏠',
    serviceLabel: 'Part-Time Cleaning',
    emoji: '🏠',
    opening: (name: string) =>
      `Great news, ${name}! We've received your request for a part-time home helper. You're just a few steps away from a cleaner, more comfortable home.`,
    context:
      'We know how valuable a reliable part-time maid is — someone who shows up on time, does thorough work, and becomes a trusted part of your daily routine. That\'s exactly what we\'re setting up for you.',
    steps: [
      'Our verification team shortlists helpers matching your locality and schedule preferences.',
      'You\'ll receive a recommended profile within 24 hours with experience details.',
      'A convenient interview is arranged — in person or via video call, your choice.',
      'Once you\'re happy, your helper begins on the agreed start date.',
    ],
    specialBox: {
      label: '💡 Pro Tip',
      text: 'Have a quick 10-minute trial task ready for the interview — like cleaning a room or organising a shelf. It helps you assess their work style firsthand.',
      bgColor: '#FFF8E7',
      borderColor: BRAND.accent,
      textColor: '#5D4E37',
      labelColor: '#B8860B',
    },
  },

  'full-time': {
    subject: 'Live-In Helper Booking Received — We\'re Finding Your Perfect Match 🏡',
    serviceLabel: 'Full-Time Live-In Helper',
    emoji: '🏡',
    opening: (name: string) =>
      `Thank you for reaching out, ${name}. A full-time live-in helper is one of the most important household decisions — and we take that seriously.`,
    context:
      'Our live-in helpers are rigorously vetted, trained, and carefully matched to your household\'s specific needs, preferences, and family dynamics. This isn\'t a quick placement — it\'s a thoughtful match.',
    steps: [
      'A senior matching specialist personally reviews your requirements and household details.',
      'We shortlist from our dedicated live-in pool — helpers who are experienced in 24-hour household management.',
      'You\'ll receive 2–3 detailed profiles including work history, languages spoken, and personality notes.',
      'Interviews are arranged at your convenience — we recommend meeting in person when possible.',
      'Full documentation, background verification, and a smooth onboarding process before Day 1.',
    ],
    specialBox: {
      label: '📝 Our Recommendation',
      text: 'We recommend a 3-day trial period before finalizing. It gives both your family and the helper time to adjust and ensures a truly comfortable fit.',
      bgColor: '#F0F7F4',
      borderColor: BRAND.primary,
      textColor: '#2D5A4A',
      labelColor: BRAND.primary,
    },
  },

  'elderly-care': {
    subject: 'Your Elderly Care Request is Confirmed — Compassionate Support is Coming 🤍',
    serviceLabel: 'Elderly Care Companion',
    emoji: '🤍',
    opening: (name: string) =>
      `We understand how much thought goes into finding the right care for someone you love, ${name}. Please know — you've made a wonderful decision, and we're honoured to be part of it.`,
    context:
      'Our elderly care companions go through specialized training, health protocol certification, and empathy assessments. They\'re not just helpers — they\'re trained to be patient, attentive, and genuinely caring companions for your loved one.',
    steps: [
      'A senior care specialist reviews the specific needs, health conditions, and daily routine of your loved one.',
      'We match from our dedicated elderly care pool — companions experienced with mobility support, medication reminders, and emotional well-being.',
      'You\'ll receive a detailed profile highlighting relevant care experience and temperament.',
      'A care orientation session is arranged so the companion understands your family\'s expectations and your loved one\'s comfort preferences.',
    ],
    specialBox: {
      label: '🤝 Our Promise',
      text: 'We will never send someone to your home who we wouldn\'t trust with our own family. Every companion is chosen with the same care you\'d expect for your own parents.',
      bgColor: '#F5F0FF',
      borderColor: '#8B7EC8',
      textColor: '#4A3F6B',
      labelColor: '#6B5CA5',
    },
  },

  cook: {
    subject: 'Cook Booking Confirmed — Great Food is Coming to Your Kitchen 👨‍🍳',
    serviceLabel: 'Professional Cook',
    emoji: '👨‍🍳',
    opening: (name: string) =>
      `Life gets so much better with a reliable, skilled cook — and we're excited to find the perfect one for you, ${name}!`,
    context:
      'Our cooks are matched by cuisine preference, dietary requirements, and cooking style. Whether you need everyday home-style meals or someone who can whip up a variety of cuisines, we\'ve got you covered.',
    steps: [
      'We match based on your city, cuisine preferences, meal frequency, and family size.',
      'You\'ll receive a cook\'s profile that includes their specialty cuisines, years of experience, and previous household feedback.',
      'A trial cooking session is arranged so you can taste their food and discuss your kitchen expectations.',
      'Once approved, your cook begins on the scheduled start date with a clear meal plan understanding.',
    ],
    specialBox: {
      label: '🍽️ Quick Tip',
      text: 'Share your preferred cuisines when we reach out — North Indian, South Indian, Continental, Jain, Sattvic, Bengali, etc. The more specific you are, the better the match!',
      bgColor: '#FFF5EB',
      borderColor: '#E8913A',
      textColor: '#6B4423',
      labelColor: '#C77B2E',
    },
  },

  nanny: {
    subject: 'Nanny Booking Received — Safe, Loving Care for Your Little One 👶',
    serviceLabel: 'Nanny / Child Caregiver',
    emoji: '👶',
    opening: (name: string) =>
      `We know how much trust it takes to bring someone new into your child's life, ${name}. That trust is something we never take lightly.`,
    context:
      'Every nanny in our network passes child safety training, first-aid certification, and thorough background verification. We match based on your child\'s age, developmental needs, and your parenting preferences.',
    steps: [
      'A child safety specialist reviews your requirements, your child\'s age group, and any specific care needs.',
      'We shortlist nannies with verified experience for your child\'s age group — infant, toddler, or young child.',
      'You\'ll receive detailed profiles including childcare experience, certifications, and personality assessments.',
      'A supervised first-day orientation is arranged so your child and the nanny can get comfortable together, with you present.',
    ],
    specialBox: {
      label: '🛡️ Safety First',
      text: 'All our nannies are child-safety trained and first-aid certified. We conduct police verification, reference checks, and health screenings before any placement.',
      bgColor: '#EFF8F8',
      borderColor: BRAND.primary,
      textColor: '#1B4D52',
      labelColor: BRAND.primary,
    },
  },

  postnatal: {
    subject: 'Postnatal Care Booking Confirmed — You\'re in Caring Hands 🌸',
    serviceLabel: 'Postnatal Care Specialist',
    emoji: '🌸',
    opening: (name: string) =>
      `Congratulations on your new arrival, ${name}. This is a beautiful, transformative time — and you absolutely deserve support through every moment of it.`,
    context:
      'Our postnatal care specialists are trained in newborn handling, mother recovery support, lactation guidance, and Indian postpartum traditions including diet, massage, and rest routines. They\'re here so you can focus on what matters most — bonding with your baby.',
    steps: [
      'A postnatal specialist reviews your delivery date, recovery needs, and any specific care preferences.',
      'We match from our dedicated postnatal care pool — caregivers experienced with newborn routines and mother wellness.',
      'You\'ll receive a detailed profile highlighting relevant postnatal experience, newborn care skills, and mother testimonials.',
      'A pre-arrival orientation call is arranged so the caregiver understands your family\'s expectations before Day 1.',
    ],
    specialBox: {
      label: '🌷 A Gentle Note',
      text: 'Please rest and focus on your recovery. Our team will handle all coordination, scheduling, and logistics. You don\'t need to worry about a thing — we\'ve got you.',
      bgColor: '#FDF2F8',
      borderColor: '#F9A8D4',
      textColor: '#831843',
      labelColor: '#BE185D',
    },
  },
};

// ─── Utility: Format Date ───────────────────────────────────────────────────────
function formatBookingDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return isoString;
  }
}

// ─── Build Email HTML ───────────────────────────────────────────────────────────
function buildEmailHtml(payload: BookingPayload, variant: ServiceVariant): string {
  const { user_name, city, booking_id, created_at, notes, service_type } = payload;
  const bookingDate = formatBookingDate(created_at);
  const firstName = user_name.split(' ')[0];
  const currentYear = new Date().getFullYear();

  const stepsHtml = variant.steps
    .map(
      (step, i) => `
      <tr>
        <td style="padding: 0 0 16px 0; vertical-align: top;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="36" style="vertical-align: top; padding-top: 2px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color: ${BRAND.primary}; color: ${BRAND.white}; font-family: ${BRAND.font}; font-size: 13px; font-weight: 700; width: 28px; height: 28px; text-align: center; line-height: 28px; border-radius: 50%;">
                      ${i + 1}
                    </td>
                  </tr>
                </table>
              </td>
              <td style="padding-left: 12px; font-family: ${BRAND.font}; font-size: 15px; line-height: 1.6; color: #3D3D3D; vertical-align: top;">
                ${step}
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join('');

  const notesSection = notes
    ? `
    <tr>
      <td style="padding: 20px 0 0 0;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border-radius: 8px; border: 1px solid #E5E7EB;">
          <tr>
            <td style="padding: 16px 20px; font-family: ${BRAND.font};">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280;">Your Notes</p>
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #374151; font-style: italic;">"${notes}"</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${variant.subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.background}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; width: 100%;">

  <!-- Outer wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${BRAND.background};">
    <tr>
      <td align="center" style="padding: 24px 16px;">

        <!-- Container 600px -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%;">

          <!-- ═══════ HEADER BAND ═══════ -->
          <tr>
            <td style="background-color: ${BRAND.primary}; border-radius: 12px 12px 0 0; padding: 32px 40px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-family: ${BRAND.font}; font-size: 26px; font-weight: 800; color: ${BRAND.white}; letter-spacing: -0.5px;">
                      ${BRAND.name}
                    </h1>
                    <p style="margin: 6px 0 0 0; font-family: ${BRAND.font}; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 1.5px;">
                      ${BRAND.tagline}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ═══════ BODY CARD ═══════ -->
          <tr>
            <td style="background-color: ${BRAND.white}; border-top: 3px solid ${BRAND.accent}; padding: 40px 40px 32px 40px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

                <!-- Greeting -->
                <tr>
                  <td style="padding: 0 0 8px 0;">
                    <p style="margin: 0; font-family: ${BRAND.font}; font-size: 13px; font-weight: 600; color: ${BRAND.accent}; text-transform: uppercase; letter-spacing: 1px;">
                      Booking Confirmed ${variant.emoji}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 0 20px 0;">
                    <h2 style="margin: 0; font-family: ${BRAND.font}; font-size: 22px; font-weight: 700; color: ${BRAND.dark}; line-height: 1.35;">
                      Hi ${firstName}, your booking is in great hands.
                    </h2>
                  </td>
                </tr>

                <!-- Opening paragraph -->
                <tr>
                  <td style="padding: 0 0 16px 0;">
                    <p style="margin: 0; font-family: ${BRAND.font}; font-size: 15px; line-height: 1.7; color: #3D3D3D;">
                      ${variant.opening(firstName)}
                    </p>
                  </td>
                </tr>

                <!-- Context paragraph -->
                <tr>
                  <td style="padding: 0 0 28px 0;">
                    <p style="margin: 0; font-family: ${BRAND.font}; font-size: 15px; line-height: 1.7; color: #5A5A5A;">
                      ${variant.context}
                    </p>
                  </td>
                </tr>

                <!-- ═══════ BOOKING DETAILS CARD ═══════ -->
                <tr>
                  <td style="padding: 0 0 28px 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFB; border-radius: 10px; border: 1px solid #E8ECEF;">
                      <tr>
                        <td style="padding: 24px;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="padding: 0 0 14px 0; border-bottom: 1px solid #E8ECEF;">
                                <p style="margin: 0; font-family: ${BRAND.font}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${BRAND.primary};">
                                  📋 Booking Details
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 14px 0 0 0;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                  <tr>
                                    <td style="padding: 6px 0; font-family: ${BRAND.font}; font-size: 13px; color: #6B7280; width: 120px; vertical-align: top;">Booking ID</td>
                                    <td style="padding: 6px 0; font-family: ${BRAND.font}; font-size: 14px; font-weight: 600; color: ${BRAND.dark}; font-variant-numeric: tabular-nums;">
                                      ${booking_id.substring(0, 8).toUpperCase()}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 6px 0; font-family: ${BRAND.font}; font-size: 13px; color: #6B7280; vertical-align: top;">Service</td>
                                    <td style="padding: 6px 0; font-family: ${BRAND.font}; font-size: 14px; font-weight: 600; color: ${BRAND.dark};">
                                      ${variant.serviceLabel}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 6px 0; font-family: ${BRAND.font}; font-size: 13px; color: #6B7280; vertical-align: top;">City</td>
                                    <td style="padding: 6px 0; font-family: ${BRAND.font}; font-size: 14px; font-weight: 600; color: ${BRAND.dark};">
                                      ${city}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 6px 0; font-family: ${BRAND.font}; font-size: 13px; color: #6B7280; vertical-align: top;">Booked On</td>
                                    <td style="padding: 6px 0; font-family: ${BRAND.font}; font-size: 14px; font-weight: 600; color: ${BRAND.dark};">
                                      ${bookingDate}
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${notesSection}

                <!-- ═══════ WHAT HAPPENS NEXT ═══════ -->
                <tr>
                  <td style="padding: 0 0 8px 0;">
                    <h3 style="margin: 0; font-family: ${BRAND.font}; font-size: 17px; font-weight: 700; color: ${BRAND.dark};">
                      What Happens Next
                    </h3>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 0 24px 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      ${stepsHtml}
                    </table>
                  </td>
                </tr>

                <!-- ═══════ SPECIAL BOX (Tip / Note / Safety) ═══════ -->
                <tr>
                  <td style="padding: 0 0 32px 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${variant.specialBox.bgColor}; border-radius: 10px; border-left: 4px solid ${variant.specialBox.borderColor};">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <p style="margin: 0 0 8px 0; font-family: ${BRAND.font}; font-size: 13px; font-weight: 700; color: ${variant.specialBox.labelColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${variant.specialBox.label}
                          </p>
                          <p style="margin: 0; font-family: ${BRAND.font}; font-size: 14px; line-height: 1.65; color: ${variant.specialBox.textColor};">
                            ${variant.specialBox.text}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- ═══════ CTA BUTTON ═══════ -->
                <tr>
                  <td align="center" style="padding: 0 0 32px 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="border-radius: 50px; background-color: ${BRAND.accent};">
                          <a href="${BRAND.website}/bookings" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: ${BRAND.font}; font-size: 15px; font-weight: 700; color: ${BRAND.dark}; text-decoration: none; border-radius: 50px; letter-spacing: 0.3px;">
                            Track My Booking →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding: 0 0 24px 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="border-top: 1px solid #E8ECEF; font-size: 0; height: 1px; line-height: 1px;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Help text -->
                <tr>
                  <td style="padding: 0;">
                    <p style="margin: 0; font-family: ${BRAND.font}; font-size: 13px; line-height: 1.6; color: #9CA3AF; text-align: center;">
                      Questions? Reach us at
                      <a href="mailto:${BRAND.supportEmail}" style="color: ${BRAND.primary}; text-decoration: underline;">${BRAND.supportEmail}</a>
                      or call
                      <a href="tel:${BRAND.supportPhone}" style="color: ${BRAND.primary}; text-decoration: underline;">${BRAND.supportPhone}</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- ═══════ FOOTER BAND ═══════ -->
          <tr>
            <td style="background-color: ${BRAND.dark}; border-radius: 0 0 12px 12px; padding: 32px 40px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 0 0 12px 0;">
                    <p style="margin: 0; font-family: ${BRAND.font}; font-size: 16px; font-weight: 700; color: ${BRAND.white};">
                      ${BRAND.name}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 0 0 16px 0;">
                    <p style="margin: 0; font-family: ${BRAND.font}; font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.6;">
                      ${BRAND.tagline}<br>
                      <a href="${BRAND.website}" style="color: ${BRAND.accent}; text-decoration: none;">${BRAND.website.replace('https://', '')}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-family: ${BRAND.font}; font-size: 11px; color: rgba(255,255,255,0.35); line-height: 1.5;">
                      © ${currentYear} ${BRAND.name}. All rights reserved.<br>
                      You received this email because you submitted a booking on our platform.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Container -->

      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->

</body>
</html>`;
}

// ─── Validation ─────────────────────────────────────────────────────────────────
const VALID_SERVICE_TYPES: ServiceType[] = [
  'part-time',
  'full-time',
  'elderly-care',
  'cook',
  'nanny',
  'postnatal',
];

function validatePayload(body: Record<string, unknown>): {
  valid: boolean;
  error?: string;
  payload?: BookingPayload;
} {
  const requiredFields = [
    'user_id',
    'user_name',
    'user_email',
    'service_type',
    'city',
    'booking_id',
    'created_at',
  ] as const;

  for (const field of requiredFields) {
    if (!body[field] || typeof body[field] !== 'string' || (body[field] as string).trim() === '') {
      return { valid: false, error: `Missing or empty required field: "${field}"` };
    }
  }

  if (!VALID_SERVICE_TYPES.includes(body.service_type as ServiceType)) {
    return {
      valid: false,
      error: `Invalid service_type "${body.service_type}". Must be one of: ${VALID_SERVICE_TYPES.join(', ')}`,
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.user_email as string)) {
    return { valid: false, error: `Invalid email format: "${body.user_email}"` };
  }

  return {
    valid: true,
    payload: {
      user_id: (body.user_id as string).trim(),
      user_name: (body.user_name as string).trim(),
      user_email: (body.user_email as string).trim().toLowerCase(),
      service_type: body.service_type as ServiceType,
      city: (body.city as string).trim(),
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
      booking_id: (body.booking_id as string).trim(),
      created_at: (body.created_at as string).trim(),
    },
  };
}

// ─── Log to email_logs ──────────────────────────────────────────────────────────
async function logEmail(
  user_id: string,
  service_type: ServiceType,
  user_email: string,
  status: 'sent' | 'failed',
  resendData: unknown,
  errorMessage: string | null,
): Promise<void> {
  try {
    await supabaseAdmin.from('email_logs').insert({
      user_id,
      email_type: `booking_${service_type}`,
      recipient_email: user_email,
      status,
      resend_response: resendData,
      error_message: errorMessage,
    });
  } catch (logError) {
    console.error('[email_logs] Failed to write log:', logError);
  }
}

// ─── Send via Resend ────────────────────────────────────────────────────────────
async function sendViaResend(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; data: unknown; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return { success: false, data: null, error: 'RESEND_API_KEY is not configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: BRAND.fromEmail,
      to: [to],
      reply_to: BRAND.replyTo,
      subject,
      html,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Resend API returned ${response.status}`;
    return { success: false, data, error: errorMsg };
  }

  return { success: true, data };
}

// ─── JSON Response Helper ───────────────────────────────────────────────────────
function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Main Handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405);
  }

  try {
    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON in request body' }, 400);
    }

    // Validate payload
    const validation = validatePayload(body);
    if (!validation.valid || !validation.payload) {
      return jsonResponse({ error: validation.error }, 400);
    }

    const payload = validation.payload;
    const variant = SERVICE_VARIANTS[payload.service_type];

    // Build the email
    const emailHtml = buildEmailHtml(payload, variant);

    // Send via Resend
    const result = await sendViaResend(payload.user_email, variant.subject, emailHtml);

    if (!result.success) {
      console.error(`[send-booking-email] Resend error for ${payload.booking_id}:`, result.error);

      // Log failure
      await logEmail(
        payload.user_id,
        payload.service_type,
        payload.user_email,
        'failed',
        result.data,
        result.error ?? 'Unknown Resend error',
      );

      return jsonResponse(
        {
          error: 'Failed to send email',
          detail: result.error,
        },
        502,
      );
    }

    console.log(
      `[send-booking-email] Sent ${payload.service_type} confirmation to ${payload.user_email} (booking: ${payload.booking_id})`,
    );

    // Log success
    await logEmail(
      payload.user_id,
      payload.service_type,
      payload.user_email,
      'sent',
      result.data,
      null,
    );

    return jsonResponse(
      {
        success: true,
        message: `Booking confirmation email sent to ${payload.user_email}`,
        booking_id: payload.booking_id,
        service_type: payload.service_type,
        resend_id: (result.data as Record<string, unknown>)?.id ?? null,
      },
      200,
    );
  } catch (err) {
    console.error('[send-booking-email] Unhandled error:', err);
    return jsonResponse(
      {
        error: 'Internal server error',
        detail: err instanceof Error ? err.message : 'Unknown error',
      },
      500,
    );
  }
});
