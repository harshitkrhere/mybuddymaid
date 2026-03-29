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

  const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyHzevpz4xDPbBkS8vKTZuuiHZFQkx2H4nEzKLiK7HDTX7a0J-eI3l5X7cc9Yq9id3Y/exec';

  // Open booking modal
  document.querySelectorAll('[data-open-booking]').forEach(btn => {
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
  document.querySelectorAll('.modal-overlay, .premium-modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        if (!document.querySelectorAll('.modal-overlay.active, .premium-modal-overlay.active').length) {
          document.body.style.overflow = '';
        }
      }
    });
  });

  // =====================================
  // 7. GOOGLE SHEETS FORM SUBMISSION
  // =====================================
  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) {
    // Replace the mock inline onsubmit attribute behavior
    bookingForm.onsubmit = null; 
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerText;
      submitBtn.innerText = 'Submitting...';
      submitBtn.disabled = true;

      const inputs = bookingForm.querySelectorAll('input, select');
      const data = { timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) };
      
      // Basic mapping from the new form structure based on order of inputs
      try {
        data.name = inputs[0].value.trim();
        data.phone = inputs[1].value.trim();
        data.email = inputs[2].value.trim();
        data.city = inputs[3].value;
        data.service = inputs[4].value;
        const notesField = document.getElementById('bookingNotes');
        data.notes = notesField && notesField.value.trim() ? notesField.value.trim() : '-';
      } catch (e) {
        data.notes = 'Error parsing notes';
      }

      try {
        await fetch(SHEETS_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch (e) { console.error(e); }

      document.getElementById('bookingFormState').style.display='none'; 
      document.getElementById('bookingSuccessState').style.display='block';
      submitBtn.innerText = originalText;
      submitBtn.disabled = false;
    });
  }

  // =====================================
  // 8. RAZORPAY SECURE ENROLLMENT
  // =====================================
  const RZP_KEY = 'rzp_live_SVW7I4Fu5WQpAt';
  const paymentModal = document.getElementById('paymentModalOverlay');
  const payPlanNameText = document.getElementById('payPlanNameText');
  const payPlanPriceText = document.getElementById('payPlanPriceText');
  const submitAmountLabel = document.getElementById('submitAmountLabel');
  
  document.querySelectorAll('[data-open-payment]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      if (!paymentModal) return;

      const plan = btn.getAttribute('data-open-payment'); // 'Silver Package'
      const priceText = btn.closest('.pricing-card').querySelector('.pricing-price').innerText.split('₹')[1].split('/')[0].replace(',','');
      const price = parseInt(priceText, 10);
      
      if (payPlanNameText) payPlanNameText.textContent = plan;
      if (payPlanPriceText) payPlanPriceText.textContent = `₹${price.toLocaleString('en-IN')}`;
      if (submitAmountLabel) submitAmountLabel.textContent = `₹${price.toLocaleString('en-IN')}`;
      
      document.getElementById('payPlanName').value = plan;
      document.getElementById('payAmount').value = price;
      
      document.getElementById('enrollStep1').style.display = 'block';
      document.getElementById('enrollStep3').style.display = 'none';

      paymentModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  const paymentForm = document.getElementById('paymentForm');
  const tncCheckbox = document.getElementById('tncCheckbox');
  const proceedPayBtn = document.getElementById('proceedPayBtn');
  
  if (tncCheckbox && proceedPayBtn) {
    tncCheckbox.addEventListener('change', () => {
      proceedPayBtn.disabled = !tncCheckbox.checked;
    });
  }

  if (paymentForm) {
    paymentForm.addEventListener('submit', e => {
      e.preventDefault();
      
      const name = document.getElementById('payName').value.trim();
      const email = document.getElementById('payEmail').value.trim();
      const phone = document.getElementById('payPhone').value.trim();
      const plan = document.getElementById('payPlanName').value;
      const amount = parseInt(document.getElementById('payAmount').value, 10);

      // --- Custom Validation ---
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^[6-9]\d{9}$/;

      if (name.length < 2) {
        alert("Please enter your full name.");
        return;
      }
      if (!emailRegex.test(email)) {
        alert("Please enter a valid email address.");
        return;
      }
      if (!phoneRegex.test(phone)) {
        alert("Please enter a valid 10-digit mobile number.");
        return;
      }
      
      const originalBtnText = proceedPayBtn.innerHTML;
      proceedPayBtn.innerHTML = 'Connecting to Secure Server...';
      proceedPayBtn.disabled = true;

      const options = {
        key: RZP_KEY,
        amount: amount * 100, // Razorpay expects paise
        currency: 'INR',
        name: 'MyBuddyMaid',
        description: plan + ' Enrollment',
        image: 'logo.png',
        prefill: { name, email, contact: phone },
        notes: { name: name, package: plan, type: 'enrollment' },
        theme: { color: '#123524' }, // Updated to match site's primary green
        handler: async function(response) {
          const data = {
            type: 'enrollment',
            timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            name, email, phone,
            package: plan, amount,
            utr: response.razorpay_payment_id,
          };
          try {
            await fetch(SHEETS_URL, {
              method: 'POST', mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
          } catch(e) {}
          
          document.getElementById('enrollStep1').style.display = 'none';
          document.getElementById('enrollStep3').style.display = 'block';
          
          setTimeout(() => {
            paymentModal.classList.remove('active');
            document.body.style.overflow = '';
            paymentForm.reset();
            tncCheckbox.checked = false;
            proceedPayBtn.disabled = true;
          }, 6000);
        }
      };
      
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response){
         proceedPayBtn.innerHTML = originalBtnText;
         proceedPayBtn.disabled = false;
      });
      rzp.open();
      
      // Reset button if modal is closed without payment
      paymentModal.addEventListener('click', (ev) => {
         // rough catch
         setTimeout(() => {
            if (document.body.style.overflow === '' && !paymentModal.classList.contains('active')) {
               proceedPayBtn.innerHTML = originalBtnText;
               proceedPayBtn.disabled = false;
            }
         }, 500);
      });
    });
  }
  
  const paymentClose = document.getElementById('paymentClose');
  if (paymentClose && paymentModal) {
    paymentClose.addEventListener('click', () => {
      paymentModal.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

});.  
 .  
 