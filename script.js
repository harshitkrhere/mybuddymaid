// ===== MyBuddyMaid — Main JavaScript =====
document.addEventListener('DOMContentLoaded', () => {

  // ---- Navbar scroll effect ----
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  });

  // ---- Mobile menu ----
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  hamburger?.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
    hamburger.classList.toggle('open');
  });
  document.querySelectorAll('.mobile-menu a').forEach(a => {
    a.addEventListener('click', () => mobileMenu.classList.remove('active'));
  });

  // ---- Smooth scroll for anchor links ----
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        mobileMenu?.classList.remove('active');
      }
    });
  });

  // ---- Scroll reveal animations ----
  const reveals = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        entry.target.style.transitionDelay = entry.target.dataset.delay || '0s';
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  reveals.forEach(el => revealObserver.observe(el));

  // ---- Counter animation ----
  function animateCounter(el) {
    const target = parseInt(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const duration = 2000;
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(target * ease).toLocaleString('en-IN') + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  const counters = document.querySelectorAll('.counter');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.counted) {
        entry.target.dataset.counted = 'true';
        animateCounter(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(el => counterObserver.observe(el));

  // ---- Testimonial Carousel ----
  const track = document.querySelector('.testimonial-track');
  const slides = document.querySelectorAll('.testimonial-slide');
  let currentSlide = 0;
  function goToSlide(n) {
    const total = slides.length;
    currentSlide = ((n % total) + total) % total;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
  }
  document.querySelector('.carousel-prev')?.addEventListener('click', () => goToSlide(currentSlide - 1));
  document.querySelector('.carousel-next')?.addEventListener('click', () => goToSlide(currentSlide + 1));
  // Auto-slide
  setInterval(() => goToSlide(currentSlide + 1), 5000);

  // ---- FAQ Accordion ----
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const wasActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      if (!wasActive) item.classList.add('active');
    });
  });



  // ---- Booking Modal ----
  const modal = document.querySelector('.modal-overlay');
  const openBtns = document.querySelectorAll('[data-open-booking]');
  const closeBtn = document.querySelector('.modal-close');

  openBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });
  closeBtn?.addEventListener('click', () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  });
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  // ---- Booking Form Submit → Google Sheets ----
  // 👇 PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE AFTER SETUP
  const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyHzevpz4xDPbBkS8vKTZuuiHZFQkx2H4nEzKLiK7HDTX7a0J-eI3l5X7cc9Yq9id3Y/exec';

  const bookingForm = document.getElementById('bookingForm');
  const formState = document.getElementById('formState');
  const successState = document.getElementById('successState');
  const submitBtn = document.getElementById('submitBtn');

  bookingForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect form data
    const data = {
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      name:    bookingForm.querySelector('[name="name"]').value.trim(),
      email:   bookingForm.querySelector('[name="email"]').value.trim(),
      phone:   bookingForm.querySelector('[name="phone"]').value.trim(),
      city:    bookingForm.querySelector('[name="city"]').value,
      service: bookingForm.querySelector('[name="service"]').value,
      notes:   bookingForm.querySelector('[name="notes"]').value.trim() || '—',
    };

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Submitting...';

    try {
      // Submit to Google Sheets via Apps Script
      await fetch(SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors', // Required for Apps Script
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      // Show success (no-cors means we can't read response, but if no error thrown = success)
      formState.style.display = 'none';
      successState.style.display = 'block';
      setTimeout(() => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        formState.style.display = 'block';
        successState.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Book My Buddy Now';
        bookingForm.reset();
      }, 3500);

    } catch (err) {
      // Show error but don't lose their data
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Book My Buddy Now';
      alert('⚠️ Submission failed. Please call us directly at +91-XXXXXXXXXX or WhatsApp us. Sorry for the inconvenience!');
      console.error('Booking submission error:', err);
    }
  });

  // ── T&C for Instant Booking Form ──
  const bookingTncCb  = document.getElementById('bookingTncCheckbox');
  const submitBtn_ref = document.getElementById('submitBtn');

  document.getElementById('openTncBooking')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('tncModalOverlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  bookingTncCb?.addEventListener('change', () => {
    if (submitBtn_ref) submitBtn_ref.disabled = !bookingTncCb.checked;
  });

  // "I Agree & Continue" in T&C modal also covers booking form checkbox
  const _origTncAgree = document.getElementById('tncAgreeBtn');
  _origTncAgree?.addEventListener('click', () => {
    if (bookingTncCb && !bookingTncCb.checked) {
      bookingTncCb.checked = true;
      if (submitBtn_ref) submitBtn_ref.disabled = false;
    }
  });

  // Reset booking checkbox when modal closes
  modal?.addEventListener('click', e => {
    if (e.target === modal && bookingTncCb) {
      bookingTncCb.checked = false;
      if (submitBtn_ref) submitBtn_ref.disabled = true;
    }
  });
  closeBtn?.addEventListener('click', () => {
    if (bookingTncCb) { bookingTncCb.checked = false; }
    if (submitBtn_ref) submitBtn_ref.disabled = true;
  });

  // ── Enrollment Modal (Razorpay Automated Payment) ──────────────────

  const RZP_KEY = 'rzp_live_SVW7I4Fu5WQpAt';

  const paymentModal  = document.getElementById('paymentModalOverlay');
  const paymentClose  = document.getElementById('paymentClose');
  const enrollStep1   = document.getElementById('enrollStep1');
  const enrollStep3   = document.getElementById('enrollStep3');
  const paymentForm   = document.getElementById('paymentForm');
  const payPlanName   = document.getElementById('payPlanName');
  const payAmount     = document.getElementById('payAmount');

  // Helper: show step + update stepper UI
  function showEnrollStep(step) {
    [enrollStep1, enrollStep3].forEach(el => { if (el) el.style.display = 'none'; });
    if (step) step.style.display = 'block';

    const dots  = [document.getElementById('stepDot1'), document.getElementById('stepDot2')];
    const lines = [document.getElementById('stepLine1')];
    const idx   = step === enrollStep1 ? 0 : 1;

    dots.forEach((d, i) => {
      if (!d) return;
      d.classList.remove('active', 'done');
      if (i < idx)  d.classList.add('done');
      if (i === idx) d.classList.add('active');
      const span = d.querySelector('span');
      if (span) span.textContent = i < idx ? '✓' : i + 1;
    });
    lines.forEach((l, i) => { if (l) l.classList.toggle('done', i < idx); });
  }

  // Open modal when a package button is clicked
  document.querySelectorAll('[data-open-payment]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const plan  = btn.getAttribute('data-open-payment');
      const price = btn.getAttribute('data-price');

      document.getElementById('payPlanNameText').textContent  = plan;
      document.getElementById('payPlanPriceText').textContent = `₹${Number(price).toLocaleString('en-IN')}`;
      const submitLabel = document.getElementById('submitAmountLabel');
      if (submitLabel) submitLabel.textContent = `₹${Number(price).toLocaleString('en-IN')}`;
      payPlanName.value = plan;
      payAmount.value   = price;

      paymentForm.reset();
      showEnrollStep(enrollStep1);
      paymentModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  // Close modal
  function closeEnrollModal() {
    paymentModal.classList.remove('active');
    document.body.style.overflow = '';
  }
  paymentClose?.addEventListener('click', closeEnrollModal);
  paymentModal?.addEventListener('click', e => { if (e.target === paymentModal) closeEnrollModal(); });

  // STEP 1: Form submit → open Razorpay checkout
  paymentForm?.addEventListener('submit', e => {
    e.preventDefault();

    // Clear previous errors
    document.querySelectorAll('.pm-field-error').forEach(el => el.remove());
    document.querySelectorAll('.pm-input-group input').forEach(el => el.style.borderColor = '');

    const nameEl  = document.getElementById('payName');
    const emailEl = document.getElementById('payEmail');
    const phoneEl = document.getElementById('payPhone');
    const name  = nameEl.value.trim();
    const email = emailEl.value.trim();
    const phone = phoneEl.value.trim();

    function showError(inputEl, msg) {
      inputEl.style.borderColor = '#ef4444';
      const err = document.createElement('small');
      err.className = 'pm-field-error';
      err.style.cssText = 'display:block;color:#ef4444;font-size:0.75rem;margin-top:4px;';
      err.textContent = msg;
      inputEl.parentNode.appendChild(err);
    }

    let valid = true;
    if (name.length < 2 || !/^[a-zA-Z\s\u0900-\u097F]+$/.test(name)) {
      showError(nameEl, 'Please enter your real full name (letters only).');
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      showError(emailEl, 'Please enter a valid email address.');
      valid = false;
    }
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''))) {
      showError(phoneEl, 'Please enter a valid 10-digit Indian mobile number.');
      valid = false;
    }
    if (!valid) return;

    const amount = parseInt(payAmount.value, 10);
    const plan   = payPlanName.value;

    const options = {
      key:         RZP_KEY,
      amount:      amount * 100,          // Razorpay expects paise
      currency:    'INR',
      name:        'MyBuddyMaid',
      description: plan + ' Enrollment Package',
      image:       'logo.png',
      prefill: { name, email, contact: phone },
      notes: { name: name, package: plan, type: 'enrollment' },
      theme: { color: '#0d9488' },
      modal: {
        ondismiss: () => {
          // User closed payment popup — stay on step 1
        }
      },
      handler: async function(response) {
        // Payment succeeded — save to Google Sheet
        const data = {
          type:               'enrollment',
          timestamp:          new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          name,
          email,
          phone,
          package:            plan,
          amount:             amount,
          utr:                response.razorpay_payment_id,   // Razorpay payment ID stored as UTR
        };
        try {
          await fetch(SHEETS_URL, {
            method:  'POST',
            mode:    'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(data),
          });
        } catch (_) { /* no-cors always throws — data still arrives */ }

        showEnrollStep(enrollStep3);

        // Auto-close after 6 seconds
        setTimeout(() => {
          closeEnrollModal();
          paymentForm.reset();
        }, 6000);
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  });

  // ── Terms & Conditions Modal ──
  const tncOverlay    = document.getElementById('tncModalOverlay');
  const tncCheckbox   = document.getElementById('tncCheckbox');
  const proceedPayBtn = document.getElementById('proceedPayBtn');

  // Open T&C when link is clicked
  document.getElementById('openTnc')?.addEventListener('click', e => {
    e.preventDefault();
    tncOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  // Close via X button
  document.getElementById('tncClose')?.addEventListener('click', () => {
    tncOverlay?.classList.remove('active');
    document.body.style.overflow = '';
  });

  // "I Agree & Continue" button — ticks checkbox and closes modal
  document.getElementById('tncAgreeBtn')?.addEventListener('click', () => {
    if (tncCheckbox) { tncCheckbox.checked = true; proceedPayBtn.disabled = false; }
    tncOverlay?.classList.remove('active');
    document.body.style.overflow = '';
  });

  // Checkbox directly enables/disables Pay Now
  tncCheckbox?.addEventListener('change', () => {
    if (proceedPayBtn) proceedPayBtn.disabled = !tncCheckbox.checked;
  });

  // Reset T&C when enrollment modal closes
  const _origClose = closeEnrollModal;
  function closeEnrollModal() {
    _origClose();
    if (tncCheckbox) { tncCheckbox.checked = false; }
    if (proceedPayBtn) proceedPayBtn.disabled = true;
  }


  // ---- Salary Calculator ----

  const calcType = document.getElementById('calcType');
  const calcCity = document.getElementById('calcCity');
  const calcResult = document.getElementById('calcResult');
  const salaryData = {
    'part-time': { metro: '8,000 - 15,000', tier2: '5,000 - 10,000' },
    'full-time': { metro: '15,000 - 25,000', tier2: '10,000 - 18,000' },
    'cook': { metro: '12,000 - 22,000', tier2: '8,000 - 15,000' },
    'nanny': { metro: '14,000 - 24,000', tier2: '10,000 - 18,000' },
    'elderly': { metro: '16,000 - 28,000', tier2: '12,000 - 22,000' },
  };
  function updateCalc() {
    if (!calcType || !calcCity) return;
    const type = calcType.value;
    const city = calcCity.value;
    const range = salaryData[type]?.[city] || '---';
    if (calcResult) calcResult.textContent = '₹' + range + '/month';
  }
  calcType?.addEventListener('change', updateCalc);
  calcCity?.addEventListener('change', updateCalc);

  // ---- Hero particles ----
  const particleContainer = document.querySelector('.hero-particles');
  if (particleContainer) {
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 10 + 4;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.background = Math.random() > 0.5
        ? 'rgba(255,107,0,0.25)'
        : 'rgba(168,213,186,0.35)';
      p.style.animationDelay = (Math.random() * 5) + 's';
      p.style.animationDuration = (Math.random() * 4 + 5) + 's';
      particleContainer.appendChild(p);
    }
  }

  // ---- Parallax on hero image ----
  const heroImg = document.querySelector('.hero-bg-image');
  if (heroImg) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      heroImg.style.transform = `translateY(${y * 0.3}px)`;
    });
  }


});
