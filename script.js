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

  // ── Enrollment Modal (3-Step QR Payment Flow) ──────────────────
  const UPI_ID   = 'shivjaan0913-2@okaxis';   // ← Change this to boss's UPI ID when ready
  const UPI_NAME = 'MyBuddyMaid';

  const paymentModal  = document.getElementById('paymentModalOverlay');
  const paymentClose  = document.getElementById('paymentClose');
  const enrollStep1   = document.getElementById('enrollStep1');
  const enrollStep2   = document.getElementById('enrollStep2');
  const enrollStep3   = document.getElementById('enrollStep3');
  const paymentForm   = document.getElementById('paymentForm');
  const payPlanName   = document.getElementById('payPlanName');
  const payAmount     = document.getElementById('payAmount');
  const paidBtn       = document.getElementById('paidBtn');
  const backToFormBtn = document.getElementById('backToFormBtn');

  // Helper: show only one step
  function showEnrollStep(step) {
    [enrollStep1, enrollStep2, enrollStep3].forEach(el => el.style.display = 'none');
    step.style.display = 'block';
  }

  // Open modal when a package button is clicked
  document.querySelectorAll('[data-open-payment]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const plan  = btn.getAttribute('data-open-payment');
      const price = btn.getAttribute('data-price');

      document.getElementById('payPlanNameText').textContent  = plan;
      document.getElementById('payPlanPriceText').textContent = `₹${Number(price).toLocaleString('en-IN')}`;
      payPlanName.value = plan;
      payAmount.value   = price;

      paymentForm.reset();
      showEnrollStep(enrollStep1);
      paymentModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  // Close modal helpers
  function closeEnrollModal() {
    paymentModal.classList.remove('active');
    document.body.style.overflow = '';
  }
  paymentClose?.addEventListener('click', closeEnrollModal);
  paymentModal?.addEventListener('click', e => { if (e.target === paymentModal) closeEnrollModal(); });

  // STEP 1 → STEP 2: validate form, generate QR
  paymentForm?.addEventListener('submit', e => {
    e.preventDefault();
    const name  = document.getElementById('payName').value.trim();
    const email = document.getElementById('payEmail').value.trim();
    const phone = document.getElementById('payPhone').value.trim();
    if (!name || !email || !phone) return;

    const amount = payAmount.value;

    // Generate UPI QR
    const upiUri = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(payPlanName.value + ' Enrollment')}`;
    document.getElementById('qrAmountDisplay').textContent = `₹${Number(amount).toLocaleString('en-IN')}`;

    new QRious({
      element: document.getElementById('enrollQRCanvas'),
      value:   upiUri,
      size:    220,
      level:   'H',
    });

    showEnrollStep(enrollStep2);
  });

  // Back button: return to form
  backToFormBtn?.addEventListener('click', () => showEnrollStep(enrollStep1));

  // STEP 2 → STEP 3: user confirms payment → save to sheet
  paidBtn?.addEventListener('click', async () => {
    paidBtn.disabled    = true;
    paidBtn.textContent = '⏳ Saving your details…';

    const data = {
      type:      'enrollment',
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      name:      document.getElementById('payName').value.trim(),
      email:     document.getElementById('payEmail').value.trim(),
      phone:     document.getElementById('payPhone').value.trim(),
      package:   payPlanName.value,
      amount:    payAmount.value,
    };

    try {
      await fetch(SHEETS_URL, {
        method: 'POST',
        mode:   'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
    } catch (_) { /* no-cors always throws — data still arrives */ }

    showEnrollStep(enrollStep3);

    // Auto-close after 5 seconds
    setTimeout(() => {
      closeEnrollModal();
      paidBtn.disabled    = false;
      paidBtn.textContent = '✅ I\'ve Completed Payment';
      paymentForm.reset();
    }, 5000);
  });


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
