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
  const calcResult = document.getElementById('calcResult');

  const rates = {
    'part-time-4hr':  { metro: '₹5,000 - ₹7,000',   tier2: '₹4,000 - ₹6,000' },
    'part-time-12hr': { metro: '₹13,000 - ₹16,000',  tier2: '₹10,000 - ₹13,000' },
    'full-time':      { metro: '₹19,000 - ₹24,000',  tier2: '₹15,000 - ₹20,000' },
    'cook':           { metro: '₹12,000 - ₹17,000',  tier2: '₹9,000 - ₹12,000' },
    'nanny':          { metro: '₹16,000 - ₹22,000',  tier2: '₹12,000 - ₹17,000' },
    'elderly':        { metro: '₹17,000 - ₹24,000',  tier2: '₹14,000 - ₹20,000' }
  };

  const updateSalary = () => {
    if (!calcType || !calcCity || !calcResult) return;
    calcResult.textContent = `${rates[calcType.value][calcCity.value]} / mo`;
  };

  if (calcType && calcCity) {
    calcType.addEventListener('change', updateSalary);
    calcCity.addEventListener('change', updateSalary);
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