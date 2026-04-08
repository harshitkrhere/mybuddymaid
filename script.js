/**
 * MyBuddyMaid — Frontend JavaScript (Complete Rebuild)
 * ═══════════════════════════════════════════════════════
 * Modern ES6+, IntersectionObserver, inline validation,
 * smooth modal system, Razorpay integration.
 * ═══════════════════════════════════════════════════════
 */

document.addEventListener('DOMContentLoaded', () => {
  const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyHzevpz4xDPbBkS8vKTZuuiHZFQkx2H4nEzKLiK7HDTX7a0J-eI3l5X7cc9Yq9id3Y/exec';
  const RZP_KEY   = 'rzp_live_SVW7I4Fu5WQpAt';

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
    'part-time': { metro: '₹8,000 - ₹12,000', tier2: '₹5,000 - ₹8,000' },
    'cook':      { metro: '₹10,000 - ₹15,000', tier2: '₹7,000 - ₹10,000' },
    'nanny':     { metro: '₹14,000 - ₹20,000', tier2: '₹10,000 - ₹15,000' },
    'elderly':   { metro: '₹15,000 - ₹22,000', tier2: '₹12,000 - ₹18,000' },
    'full-time': { metro: '₹18,000 - ₹25,000', tier2: '₹14,000 - ₹20,000' }
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
  // 6. MODAL SYSTEM
  // ═══════════════════════════════════════════════════════
  const openModal = (modal) => {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = (modal) => {
    if (!modal) return;
    modal.classList.remove('active');
    // Re-enable scroll only if no other modals are open
    const anyOpen = document.querySelector('.modal-overlay.active, .pay-modal-overlay.active');
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
  document.querySelectorAll('.modal-overlay, .pay-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal-overlay.active, .pay-modal-overlay.active');
      if (open) closeModal(open);
    }
  });

  // ═══════════════════════════════════════════════════════
  // 7. BOOKING MODAL
  // ═══════════════════════════════════════════════════════
  const bookingModal   = document.getElementById('bookingModal');
  const bookingForm    = document.getElementById('bookingForm');
  const formState      = document.getElementById('bookingFormState');
  const successState   = document.getElementById('bookingSuccessState');
  const serviceSelect  = document.getElementById('bookService');
  const serviceGroup   = document.getElementById('serviceSelectGroup');

  // Open booking
  document.querySelectorAll('[data-open-booking]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      // Reset states
      if (formState) formState.style.display = 'block';
      if (successState) successState.style.display = 'none';
      if (bookingForm) bookingForm.reset();

      const serviceName = btn.getAttribute('data-open-booking');
      if (serviceName && serviceSelect && serviceGroup) {
        serviceSelect.value = serviceName;
        serviceGroup.style.display = 'none';
      } else if (serviceGroup) {
        serviceGroup.style.display = 'block';
      }

      openModal(bookingModal);
      validateBookingForm();
    });
  });

  // Continue to pricing
  const btnToPricing = document.getElementById('btnContinueToPricing');
  if (btnToPricing) {
    btnToPricing.addEventListener('click', () => {
      closeModal(bookingModal);
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Booking form validation — enable submit only when all fields filled + T&C checked
  const bookSubmitBtn = document.getElementById('bookSubmitBtn');
  const bookTncCheck  = document.getElementById('bookTncCheck');
  const bookRequiredFields = ['bookName', 'bookPhone', 'bookEmail', 'bookCity', 'bookService'];

  const validateBookingForm = () => {
    if (!bookSubmitBtn) return;
    const allFilled = bookRequiredFields.every(id => {
      const el = document.getElementById(id);
      return el && el.value.trim() !== '';
    });
    const tncChecked = bookTncCheck ? bookTncCheck.checked : false;
    bookSubmitBtn.disabled = !(allFilled && tncChecked);
  };

  // Attach listeners to all required fields + checkbox
  bookRequiredFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', validateBookingForm);
      el.addEventListener('change', validateBookingForm);
    }
  });
  if (bookTncCheck) bookTncCheck.addEventListener('change', validateBookingForm);

  // Initial state
  if (bookSubmitBtn) bookSubmitBtn.disabled = true;

  // Submit booking form
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (bookSubmitBtn.disabled) return;

      const origText = bookSubmitBtn.textContent;
      bookSubmitBtn.textContent = 'Submitting...';
      bookSubmitBtn.disabled = true;

      const data = {
        timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        name:    document.getElementById('bookName').value.trim(),
        phone:   document.getElementById('bookPhone').value.trim(),
        email:   document.getElementById('bookEmail').value.trim(),
        city:    document.getElementById('bookCity').value,
        service: document.getElementById('bookService').value,
        notes:   document.getElementById('bookNotes').value.trim() || '-',
      };

      try {
        await fetch(SHEETS_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch (err) {
        console.error('Booking submission error:', err);
      }

      formState.style.display = 'none';
      successState.style.display = 'block';
      bookSubmitBtn.textContent = origText;
      bookSubmitBtn.disabled = false;
    });
  }

  // ═══════════════════════════════════════════════════════
  // 8. T&C MODAL
  // ═══════════════════════════════════════════════════════
  const tncModal = document.getElementById('tncModal');

  [document.getElementById('modalTncLink'), document.getElementById('footerTncLink'), document.getElementById('payTncLink')].forEach(link => {
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(tncModal);
      });
    }
  });

  // ═══════════════════════════════════════════════════════
  // 9. PAYMENT MODAL & RAZORPAY
  // ═══════════════════════════════════════════════════════
  const paymentModal     = document.getElementById('paymentModal');
  const paymentForm      = document.getElementById('paymentForm');
  const payTncCheck      = document.getElementById('payTncCheck');
  const paySubmitBtn     = document.getElementById('paySubmitBtn');
  const payPlanName      = document.getElementById('payPlanName');
  const payPlanPrice     = document.getElementById('payPlanPrice');
  const payPlanEmoji     = document.getElementById('payPlanEmoji');
  const paySubmitAmount  = document.getElementById('paySubmitAmount');
  const payStep1Content  = document.getElementById('payStep1Content');
  const payStep2Content  = document.getElementById('payStep2Content');
  const payStep1Dot      = document.getElementById('payStep1');
  const payStep2Dot      = document.getElementById('payStep2');
  const payClose         = document.getElementById('paymentClose');

  // Open payment modal
  document.querySelectorAll('[data-open-payment]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!paymentModal) return;

      const plan = btn.getAttribute('data-open-payment');
      const priceText = btn.closest('.pricing-card').querySelector('.pricing-amount').textContent;
      const price = parseInt(priceText.replace(/[^\d]/g, ''), 10);

      const emojiMap = {
        'Silver Package': '🥈',
        'Gold Package': '🥇',
        'Diamond Package': '💎',
        'Platinum Package': '👑'
      };

      payPlanName.textContent = plan;
      payPlanPrice.textContent = `₹${price.toLocaleString('en-IN')}`;
      payPlanEmoji.textContent = emojiMap[plan] || '✨';
      paySubmitAmount.textContent = `₹${price.toLocaleString('en-IN')}`;

      document.getElementById('payHiddenPlan').value = plan;
      document.getElementById('payHiddenAmount').value = price;

      // Reset to step 1
      payStep1Content.style.display = 'block';
      payStep2Content.style.display = 'none';
      payStep1Dot.classList.add('active');
      payStep2Dot.classList.remove('active');

      // Reset form
      if (paymentForm) paymentForm.reset();
      if (payTncCheck) payTncCheck.checked = false;
      if (paySubmitBtn) paySubmitBtn.disabled = true;
      clearPayErrors();

      openModal(paymentModal);
    });
  });

  // Close payment
  if (payClose && paymentModal) {
    payClose.addEventListener('click', () => closeModal(paymentModal));
  }

  // T&C checkbox enables submit
  if (payTncCheck && paySubmitBtn) {
    payTncCheck.addEventListener('change', () => {
      paySubmitBtn.disabled = !payTncCheck.checked;
    });
  }

  // Inline validation helpers
  const showError = (inputId, errorId) => {
    document.getElementById(inputId)?.classList.add('input-error');
    const errEl = document.getElementById(errorId);
    if (errEl) errEl.style.display = 'block';
  };
  const clearError = (inputId, errorId) => {
    document.getElementById(inputId)?.classList.remove('input-error');
    const errEl = document.getElementById(errorId);
    if (errEl) errEl.style.display = 'none';
  };
  const clearPayErrors = () => {
    ['payName', 'payEmail', 'payPhone'].forEach(id => {
      document.getElementById(id)?.classList.remove('input-error');
    });
    ['payNameError', 'payEmailError', 'payPhoneError'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  };

  // Payment form submit
  if (paymentForm) {
    paymentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearPayErrors();

      const name  = document.getElementById('payName').value.trim();
      const email = document.getElementById('payEmail').value.trim();
      const phone = document.getElementById('payPhone').value.trim();
      const plan  = document.getElementById('payHiddenPlan').value;
      const amount = parseInt(document.getElementById('payHiddenAmount').value, 10);

      // Validate
      let valid = true;
      if (name.length < 2) { showError('payName', 'payNameError'); valid = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('payEmail', 'payEmailError'); valid = false; }
      if (!/^[6-9]\d{9}$/.test(phone)) { showError('payPhone', 'payPhoneError'); valid = false; }
      if (!valid) return;

      const origBtnHtml = paySubmitBtn.innerHTML;
      paySubmitBtn.innerHTML = 'Connecting to Secure Server...';
      paySubmitBtn.disabled = true;

      const rzpOptions = {
        key: RZP_KEY,
        amount: amount * 100,
        currency: 'INR',
        name: 'MyBuddyMaid',
        description: plan + ' Enrollment',
        image: 'logo.png',
        prefill: { name, email, contact: phone },
        notes: { name, package: plan, type: 'enrollment' },
        theme: { color: '#0F0F0F' },
        handler: async (response) => {
          // Payment success — log to sheets
          const data = {
            type: 'enrollment',
            timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            name, email, phone,
            package: plan,
            amount,
            utr: response.razorpay_payment_id,
          };

          try {
            await fetch(SHEETS_URL, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
          } catch (err) {
            console.error('Enrollment logging error:', err);
          }

          // Show success step
          payStep1Content.style.display = 'none';
          payStep2Content.style.display = 'block';
          payStep1Dot.classList.remove('active');
          payStep2Dot.classList.add('active');

          // Auto-close after 6s
          setTimeout(() => {
            closeModal(paymentModal);
            paymentForm.reset();
            payTncCheck.checked = false;
            paySubmitBtn.disabled = true;
          }, 6000);
        }
      };

      const rzp = new Razorpay(rzpOptions);
      rzp.on('payment.failed', () => {
        paySubmitBtn.innerHTML = origBtnHtml;
        paySubmitBtn.disabled = !payTncCheck.checked;
      });
      rzp.open();

      // Reset button if user dismisses Razorpay
      setTimeout(() => {
        if (payStep1Content.style.display !== 'none') {
          paySubmitBtn.innerHTML = origBtnHtml;
          paySubmitBtn.disabled = !payTncCheck.checked;
        }
      }, 1000);
    });
  }
});