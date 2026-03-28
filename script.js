document.addEventListener('DOMContentLoaded', () => {
  // =====================================
  // 1. STICKY NAVBAR
  // =====================================
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // =====================================
  // 2. MOBILE MENU
  // =====================================
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileLinks = mobileMenu.querySelectorAll('a');

  function toggleMobileMenu() {
    mobileMenu.classList.toggle('active');
    const spans = mobileMenuBtn.querySelectorAll('span');
    if (mobileMenu.classList.contains('active')) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    }
  }

  mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mobileMenu.classList.contains('active')) {
        toggleMobileMenu();
      }
    });
  });

  // =====================================
  // 3. SCROLL REVEAL ANIMATION (Intersection Observer)
  // =====================================
  const revealElements = document.querySelectorAll('.reveal');
  const revealOptions = {
    threshold: 0.15,
    rootMargin: "0px 0px -50px 0px"
  };

  const revealObserver = new IntersectionObserver(function(entries, observer) {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('active');
      observer.unobserve(entry.target);
    });
  }, revealOptions);

  revealElements.forEach(el => {
    revealObserver.observe(el);
  });

  // =====================================
  // 4. FAQ ACCORDION
  // =====================================
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    btn.addEventListener('click', () => {
      // Close all others
      faqItems.forEach(otherItem => {
        if (otherItem !== item && otherItem.classList.contains('active')) {
          otherItem.classList.remove('active');
        }
      });
      // Toggle current
      item.classList.toggle('active');
    });
  });

  // =====================================
  // 5. SALARY ESTIMATOR TOOL
  // =====================================
  const calcType = document.getElementById('calcType');
  const calcCity = document.getElementById('calcCity');
  const calcResult = document.getElementById('calcResult');

  const rates = {
    'part-time': { metro: '₹8,000 - ₹12,000', tier2: '₹5,000 - ₹8,000' },
    'cook': { metro: '₹10,000 - ₹15,000', tier2: '₹7,000 - ₹10,000' },
    'nanny': { metro: '₹14,000 - ₹20,000', tier2: '₹10,000 - ₹15,000' },
    'elderly': { metro: '₹15,000 - ₹22,000', tier2: '₹12,000 - ₹18,000' },
    'full-time': { metro: '₹18,000 - ₹25,000', tier2: '₹14,000 - ₹20,000' }
  };

  function calculateSalary() {
    if (!calcType || !calcCity || !calcResult) return;
    const type = calcType.value;
    const city = calcCity.value;
    calcResult.textContent = `${rates[type][city]} / mo`;
  }

  if (calcType && calcCity) {
    calcType.addEventListener('change', calculateSalary);
    calcCity.addEventListener('change', calculateSalary);
    calculateSalary(); // initial load
  }

  // =====================================
  // 6. MODALS LOGIC
  // =====================================
  const bookingModal = document.getElementById('bookingModal');
  const tncModal = document.getElementById('tncModal');

  // Open booking modal
  document.querySelectorAll('[data-open-booking], [data-open-payment]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Reset form state if it was successful previously
      const formState = document.getElementById('bookingFormState');
      const successState = document.getElementById('bookingSuccessState');
      const form = document.getElementById('bookingForm');
      const serviceSelect = document.getElementById('modalServiceSelect');
      const serviceSelectGroup = document.getElementById('serviceSelectGroup');
      
      if (formState && successState) {
        formState.style.display = 'block';
        successState.style.display = 'none';
      }
      if (form) form.reset();

      const serviceName = btn.getAttribute('data-open-booking');
      if (serviceName && serviceSelect && serviceSelectGroup) {
         serviceSelect.value = serviceName;
         serviceSelectGroup.style.display = 'none'; // Hide the select visual
      } else if (serviceSelectGroup) {
         serviceSelectGroup.style.display = 'block';
      }

      // If clicked from pricing, auto-select package info (Optional enhancement)
      const packageType = btn.getAttribute('data-open-payment');
      if (packageType) {
        // Find select box and set it roughly, or just know user came from pricing
      }

      bookingModal.classList.add('active');
      document.body.style.overflow = 'hidden'; // stop background scroll
    });
  });

  // Handle slide down to pricing after successful booking
  const btnContinueToPricing = document.getElementById('btnContinueToPricing');
  if (btnContinueToPricing) {
    btnContinueToPricing.addEventListener('click', () => {
      bookingModal.classList.remove('active');
      if (!document.querySelectorAll('.modal-overlay.active').length) {
        document.body.style.overflow = '';
      }
      
      const pricingSection = document.getElementById('pricing');
      if (pricingSection) {
        pricingSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Open T&C modal
  const openTncBtns = [document.getElementById('modalTncLink'), document.getElementById('footerTncLink')];
  openTncBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        // If clicking from inside booking modal, close booking modal first or just stack
        tncModal.classList.add('active');
      });
    }
  });

  // Close Modals
  document.querySelectorAll('[data-close-modal], .modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      // Find closest modal overlay and remove class
      const modal = btn.closest('.modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        
        // Only re-enable scroll if ALL modals are closed
        if (!document.querySelectorAll('.modal-overlay.active').length) {
          document.body.style.overflow = '';
        }
      }
    });
  });

  // Click outside modal to close
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        if (!document.querySelectorAll('.modal-overlay.active').length) {
          document.body.style.overflow = '';
        }
      }
    });
  });

});
