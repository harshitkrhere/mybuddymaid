/**
 * MyBuddyMaid — Frontend JavaScript
 * ═══════════════════════════════════════════════════════
 * Modern ES6+, IntersectionObserver, modal system for
 * T&C / Privacy, FAQ accordion, salary estimator.
 * ═══════════════════════════════════════════════════════
 */
'use strict';

// ── App Redirect (same domain) ──
function redirectToApp(context) {
  if (context) {
    sessionStorage.setItem('mbm_redirect_context', context);
  }
  window.location.href = '/auth';
}

document.addEventListener('DOMContentLoaded', () => {

  // ═══════════════════════════════════════════════════════
  // 1. STICKY NAVBAR
  // ═══════════════════════════════════════════════════════
  const navbar = document.getElementById('navbar');
  const stickyCta = document.getElementById('stickyCta');
  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Sticky CTA bar — show when hero is scrolled past
  const heroSection = document.getElementById('hero');
  if (heroSection && stickyCta) {
    const stickyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        stickyCta.classList.toggle('visible', !entry.isIntersecting);
      });
    }, { threshold: 0.05 });
    stickyObserver.observe(heroSection);
  }

  // ═══════════════════════════════════════════════════════
  // 2. MOBILE MENU
  // ═══════════════════════════════════════════════════════
  const menuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');

  const toggleMenu = () => {
    const isOpen = mobileMenu.classList.toggle('active');
    const spans = menuBtn.querySelectorAll('span');
    spans[0].style.transform = isOpen ? 'rotate(45deg) translate(5px, 5px)' : '';
    spans[1].style.opacity   = isOpen ? '0' : '1';
    spans[2].style.transform = isOpen ? 'rotate(-45deg) translate(5px, -5px)' : '';
  };

  menuBtn.addEventListener('click', toggleMenu);
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (mobileMenu.classList.contains('active')) toggleMenu();
    });
  });

  // ═══════════════════════════════════════════════════════
  // 3. SCROLL REVEAL (IntersectionObserver)
  // ═══════════════════════════════════════════════════════
  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ═══════════════════════════════════════════════════════
  // 4. FAQ ACCORDION
  // ═══════════════════════════════════════════════════════
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-question').addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      // Close all
      document.querySelectorAll('.faq-item').forEach(other => {
        other.classList.remove('active');
        const ans = other.querySelector('.faq-answer');
        if (ans) ans.style.maxHeight = null;
      });
      // Open clicked if it was closed
      if (!isActive) {
        item.classList.add('active');
        const answer = item.querySelector('.faq-answer');
        if (answer) answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // ═══════════════════════════════════════════════════════
  // 5. SALARY ESTIMATOR
  // ═══════════════════════════════════════════════════════
  const calcType   = document.getElementById('calcType');
  const calcCity   = document.getElementById('calcCity');
  const calcHours  = document.getElementById('calcHours');
  const calcResult = document.getElementById('calcResult');
  const calcNote   = document.getElementById('calcNote');
  const hoursLabel = document.getElementById('hoursLabel');
  const hoursGroup = document.getElementById('hoursGroup');

  // Salary data points for maids (metro): interpolated by hours
  // Reference: 4hrs=5-7K, 8hrs=10-13K, 12hrs=13-16K, 24hrs(live-in)=19-24K
  const maidRatesMetro = [
    { hrs: 2,  min: 3000,  max: 4500  },
    { hrs: 4,  min: 5000,  max: 7000  },
    { hrs: 6,  min: 7500,  max: 10000 },
    { hrs: 8,  min: 10000, max: 13000 },
    { hrs: 10, min: 11500, max: 14500 },
    { hrs: 12, min: 13000, max: 16000 },
    { hrs: 16, min: 15000, max: 19000 },
    { hrs: 20, min: 17000, max: 22000 },
    { hrs: 24, min: 19000, max: 24000 },
  ];
  const maidRatesTier2 = [
    { hrs: 2,  min: 2000,  max: 3500  },
    { hrs: 4,  min: 4000,  max: 6000  },
    { hrs: 6,  min: 6000,  max: 8000  },
    { hrs: 8,  min: 8000,  max: 10500 },
    { hrs: 10, min: 9500,  max: 12000 },
    { hrs: 12, min: 10500, max: 13000 },
    { hrs: 16, min: 12500, max: 16000 },
    { hrs: 20, min: 14000, max: 19000 },
    { hrs: 24, min: 15000, max: 20000 },
  ];

  // Fixed rates for specialist roles
  const specialistRates = {
    cook:    { metro: [12000, 17000], tier2: [9000, 12000] },
    nanny:   { metro: [16000, 22000], tier2: [12000, 17000] },
    elderly: { metro: [17000, 24000], tier2: [14000, 20000] },
  };

  function interpolate(points, hrs) {
    if (hrs <= points[0].hrs) return { min: points[0].min, max: points[0].max };
    if (hrs >= points[points.length - 1].hrs) return { min: points[points.length - 1].min, max: points[points.length - 1].max };
    for (let i = 0; i < points.length - 1; i++) {
      if (hrs >= points[i].hrs && hrs <= points[i + 1].hrs) {
        const t = (hrs - points[i].hrs) / (points[i + 1].hrs - points[i].hrs);
        return {
          min: Math.round((points[i].min + t * (points[i + 1].min - points[i].min)) / 500) * 500,
          max: Math.round((points[i].max + t * (points[i + 1].max - points[i].max)) / 500) * 500,
        };
      }
    }
    return { min: points[0].min, max: points[0].max };
  }

  function fmt(n) { return '₹' + n.toLocaleString('en-IN'); }

  function updateSalary() {
    if (!calcType || !calcResult) return;
    const type = calcType.value;
    const city = calcCity ? calcCity.value : 'metro';
    const hours = calcHours ? parseInt(calcHours.value) : 4;

    // Show/hide hours slider based on service type
    if (hoursGroup) hoursGroup.style.display = type === 'maid' ? 'block' : 'none';
    if (hoursLabel) hoursLabel.textContent = hours >= 24 ? 'Live-in (24 hrs)' : hours + ' hrs';

    let minSal, maxSal, note;

    if (type === 'maid') {
      const pts = city === 'metro' ? maidRatesMetro : maidRatesTier2;
      const result = interpolate(pts, hours);
      minSal = result.min;
      maxSal = result.max;
      note = hours >= 20 ? 'Live-in' : hours <= 4 ? 'Part-time' : hours <= 12 ? 'Half-day / Full-day' : 'Extended hours';
    } else {
      const rates = specialistRates[type];
      const r = city === 'metro' ? rates.metro : rates.tier2;
      minSal = r[0];
      maxSal = r[1];
      note = type === 'cook' ? 'Full-time cook' : type === 'nanny' ? 'Full-time nanny' : 'Full-time elderly care';
    }

    note += city === 'metro' ? ' • Metro city rates' : ' • Tier-2 city rates';
    calcResult.textContent = `${fmt(minSal)} – ${fmt(maxSal)} / mo`;
    if (calcNote) calcNote.textContent = note;
  }

  if (calcType) {
    calcType.addEventListener('change', updateSalary);
    if (calcCity) calcCity.addEventListener('change', updateSalary);
    if (calcHours) calcHours.addEventListener('input', updateSalary);
    updateSalary();
  }

  // ═══════════════════════════════════════════════════════
  // 6. MODAL SYSTEM (T&C / Privacy)
  // ═══════════════════════════════════════════════════════
  const openModal = (modal) => {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = (modal) => {
    if (!modal) return;
    modal.classList.remove('active');
    const anyOpen = document.querySelector('.modal-overlay.active');
    if (!anyOpen) document.body.style.overflow = '';
  };

  // Close buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = btn.closest('.modal-overlay');
      if (modal) closeModal(modal);
    });
  });

  // Click outside to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal-overlay.active');
      if (open) closeModal(open);
    }
  });

  // ═══════════════════════════════════════════════════════
  // 7. T&C MODAL
  // ═══════════════════════════════════════════════════════
  const tncModal = document.getElementById('tncModal');

  [document.getElementById('footerTncLink')].forEach(link => {
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(tncModal);
      });
    }
  });

  // ═══════════════════════════════════════════════════════
  // 8. PRIVACY POLICY MODAL
  // ═══════════════════════════════════════════════════════
  const privacyModal = document.getElementById('privacyModal');
  const footerPrivacyLink = document.getElementById('footerPrivacyLink');
  if (footerPrivacyLink && privacyModal) {
    footerPrivacyLink.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(privacyModal);
    });
  }

});