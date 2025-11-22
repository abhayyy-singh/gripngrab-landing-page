  // SLOT BOOKING SYSTEM WITH FIREBASE
const MAX_SLOTS = 20;
let totalBookings = 0;

// Initialize Firebase real-time listener
function initBookingSystem() {
    // If slot system is disabled, skip Firebase initialization
    if (!SLOT_CONFIG.enabled) {
        console.log('Slot system disabled - unlimited registrations allowed');
        const counterEl = document.getElementById('spotsCounter');
        if (counterEl) counterEl.style.display = 'none';
        return;
    }

    const spotsRef = window.firebaseRef(window.firebaseDB, 'availableSpots');
    
    // Real-time listener - sabko same value dikhega
    window.firebaseOnValue(spotsRef, (snapshot) => {
        let availableSpots = snapshot.val();
        
        // Agar null hai toh initialize karo
        if (availableSpots === null) {
            console.log('⚠️ Firebase empty, initializing with 20');
            window.firebaseRunTransaction(spotsRef, () => 20);
            availableSpots = 20;
        }
        
        // 0 ko valid value treat karo (|| 20 mat use karo!)
        totalBookings = MAX_SLOTS - availableSpots;
        
        console.log('🔄 Firebase update:', availableSpots, 'spots available');

        
        updateSpotsCounter();
        
        // Check if fully booked
        if (availableSpots <= 0) {
            disableAllRegistrationButtons();
        }
    });
}


      // Update the spots counter display
      function updateSpotsCounter() {
        const remaining = MAX_SLOTS - totalBookings;
        const percentage = (remaining / MAX_SLOTS) * 100;
        
        // Update remaining spots number
        const remainingEl = document.getElementById('spotsRemaining');
        if (remainingEl) {
          remainingEl.textContent = remaining;
                  // Agar 0 spots hain toh modal automatically show karo
        if (remaining === 0) {
            console.log('🚫 0 Spots - Triggering fully booked modal');
            showFullyBookedModal();
        }

          
          // Animate number change
          remainingEl.style.animation = 'none';
          setTimeout(() => {
            remainingEl.style.animation = 'ggwBounce 0.5s ease';
          }, 10);
        }

        // Update progress bar
        const progressBar = document.getElementById('spotsBar');
        const badge = document.querySelector('.ggw-spots-badge');
        const message = document.getElementById('spotsMessage');
        
        if (progressBar) {
          progressBar.style.width = percentage + '%';
          
          // Color coding based on availability
          if (remaining > 14) {
            progressBar.classList.remove('warning', 'danger');
            if (badge) badge.className = 'ggw-spots-badge';
            if (message) message.textContent = 'Hurry! Limited seats available';
          } else if (remaining > 5) {
            progressBar.classList.add('warning');
            progressBar.classList.remove('danger');
            if (badge) badge.className = 'ggw-spots-badge orange';
            if (message) message.textContent = '⚡ Filling up fast! Reserve your spot now';
          } else if (remaining > 0) {
            progressBar.classList.add('danger');
            progressBar.classList.remove('warning');
            if (badge) badge.className = 'ggw-spots-badge red';
            if (message) message.textContent = '🚨 URGENT! Only ' + remaining + ' spots left!';
          } else {
            progressBar.style.width = '0%';
            if (badge) badge.className = 'ggw-spots-badge red';
            if (message) message.textContent = '❌ Workshop Fully Booked';
          }
        }
      }

      // Disable all registration buttons when fully booked
      function disableAllRegistrationButtons() {
    console.log('🔒 Disabling all registration buttons');
    const registerButtons = document.querySelectorAll('.register-btn, .cta-button');
    registerButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.textContent = 'Fully Booked'; // Change button text
    });
    
    // Update badge to show "Fully Booked"
    const badgeEl = document.querySelector('.badge');
    if (badgeEl) {
        badgeEl.textContent = '🚫 Fully Booked!';
        badgeEl.classList.add('badge--urgent');
    }
}


      // Show fully booked modal
      function showFullyBookedModal() {
        const modal = document.getElementById('fullyBookedModal');
        if (modal) {
          modal.style.display = 'block';
        }
      }

      // Close fully booked modal
      function closeFullyBookedModal() {
        const modal = document.getElementById('fullyBookedModal');
        if (modal) {
          modal.style.display = 'none';
        }
      }

      // Handle waitlist submission
      function submitWaitlist() {
        const emailInput = document.getElementById('waitlistEmail');
        if (!emailInput) return;
        
        const email = emailInput.value.trim();
        
        if (!email) {
          alert('Please enter your email address');
          return;
        }
        
        // Email validation
        const emailRegex = /^[^ @]+@[^ @]+\.[^ @]+$/;
        if (!emailRegex.test(email)) {
          alert('Please enter a valid email address');
          return;
        }
        
        // Here you can integrate with EmailJS or your backend
        console.log('Waitlist email:', email);
        
        // Show success message
        alert('Thank you! We will notify you about the next workshop.');
        
        // Clear input and close modal
        emailInput.value = '';
        closeFullyBookedModal();
      }
// Decrement available spots in Firebase
function decrementAvailableSpots() {
    // If slot system is disabled, don't decrement
    if (!SLOT_CONFIG.enabled) {
        console.log('Slot system disabled - skipping decrement');
        return Promise.resolve();
    }

    const spotsRef = window.firebaseRef(window.firebaseDB, 'availableSpots');
    
    window.firebaseRunTransaction(spotsRef, (currentSpots) => {
        console.log('📝 Transaction running, current value:', currentSpots);
        
        // Agar null hai - abort transaction (database not ready)
        if (currentSpots === null) {
            console.error('❌ Database value is null - aborting');
            return; // Return undefined = abort
        }
        
        // Agar 0 ya negative hai - no decrement
        if (currentSpots <= 0) {
            console.warn('⚠️ Already at 0, cannot decrement');
            return 0; // Stay at 0
        }
        
        // Normal case - decrement
        const newValue = currentSpots - 1;
        console.log(`📉 Decrementing: ${currentSpots} → ${newValue}`);
        return newValue;

        
    }).then(() => {
        console.log('✅ Spot successfully decremented in Firebase');
    }).catch((error) => {
        console.error('❌ Error decrementing spot:', error);
    });
}


      // ========================================
      // ORIGINAL CODE (Modified)
      // ========================================
      
      // Initialize EmailJS
      emailjs.init("wwGXMDT6ekGDIkKNg");

      // Counter Animation
      function animateCounter(element) {
        const target = parseInt(element.getAttribute("data-target"));
        const duration = 2000;
        const increment = target / (duration / 16);
        let current = 0;

        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            element.textContent = target + "+";
            clearInterval(timer);
          } else {
            element.textContent = Math.floor(current);
          }
        }, 16);
      }

      // Intersection Observer for Counter Animation
      const observerOptions = {
        threshold: 0.5,
        rootMargin: "0px",
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const counters = entry.target.querySelectorAll(".ggw-counter");
            counters.forEach((counter) => {
              if (!counter.classList.contains("animated")) {
                counter.classList.add("animated");
                animateCounter(counter);
              }
            });
          }
        });
      }, observerOptions);

      // Observe the features section
      const featuresSection = document.querySelector(".ggw-features");
      if (featuresSection) {
        observer.observe(featuresSection);
      }

      // Toggle Mobile Menu
      function toggleMobileMenu() {
        const mobileMenu = document.getElementById("mobileMenu");
        const hamburger = document.querySelector(".ggw-hamburger");
        mobileMenu.classList.toggle("active");
        hamburger.classList.toggle("active");
      }

     // Open Modal - MODIFIED TO CHECK SLOTS
function openModal() {
    const remaining = MAX_SLOTS - totalBookings;
    
    // CHECK IF SLOTS ARE AVAILABLE
    if (remaining <= 0) {
        console.log('🚫 Workshop Fully Booked - Opening waitlist modal');
        showFullyBookedModal();
        return;
    }
    
    console.log(`✅ ${remaining} spots available - Opening registration`);
    document.getElementById('registrationModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

      // Close Modal
      function closeModal() {
        document.getElementById("registrationModal").classList.remove("active");
        document.body.style.overflow = "auto";
        document.getElementById("formContainer").style.display = "block";
        document.getElementById("successMessage").classList.remove("active");
        document.getElementById("registrationForm").reset();
      }

      // Smooth scroll
      document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
          const href = this.getAttribute("href");
          if (href !== "#" && href !== "#home") {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
              target.scrollIntoView({ behavior: "smooth" });
            }
          }
        });
      });

      // Form submission
      document
        .getElementById("registrationForm")
        
        .addEventListener("submit", async function (e) {
          e.preventDefault();

          const submitBtn = e.target.querySelector(".ggw-submit-btn");
          submitBtn.disabled = true;
          submitBtn.textContent = "Processing...";

          const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            workshopDate: '23th November 2025',
            location: 'Lajpat Nagar, Delhi',
            fee: '₹1000'
          };

          try {
            // Razorpay Payment
            const options = {
              key: "rzp_live_RZDqqPc9XD0IjO",
              amount: 100000,
              currency: "INR",
              name: "Grip&Grab",
              description: "Master the art of Movement Workshop Registration",






handler: async function (response) {
    console.log('Payment successful! Payment ID:', response.razorpay_payment_id);
    
    // DECREMENT AVAILABLE SPOTS IN FIREBASE...
    decrementAvailableSpots();
    
    // ✅ GET SELECTED WORKSHOP DATA (defaults to Back Lever)
    const workshop = selectedWorkshopData || {
        name: 'Back Lever Workshop',
        date: '23rd November 2025',
        time: '11:00 AM - 1:00 PM',
        venue: 'GripGrab Studio, Lajpat Nagar',
        fee: '₹1,000',
        emailTemplateUser: 'template_1k0fnrn',
        emailTemplateAdmin: 'template_axjwehu'
    };
    
    const emailParams = {
        to_email: formData.email,
        to_name: `${formData.firstName} ${formData.lastName}`,
        from_name: 'GripGrab',
        firstName: formData.firstName,
        lastName: formData.lastName,
        user_email: formData.email,
        phone: formData.phone,
        
        // ✅ WORKSHOP-SPECIFIC FIELDS
        workshop_name: workshop.name,
        workshop_date: workshop.date,
        workshop_time: workshop.time,
        workshop_venue: workshop.venue,
        workshop_fee: workshop.fee,
        
        amount: workshop.fee,
        paymentId: response.razorpay_payment_id,
    };










try {
    // Email 1: User ko confirmation (workshop-specific template)
    console.log('Sending user confirmation to:', formData.email);
    console.log('Using template:', workshop.emailTemplateUser);
    await emailjs.send('harishteamgng', workshop.emailTemplateUser, emailParams)
        .then((response) => {
            console.log('User email SUCCESS!', response.status, response.text);
        })
        .catch((error) => {
            console.error('User email FAILED:', error);
            throw error;
        });

    // Email 2: Admin ko notification (workshop-specific template)
    console.log('Sending admin notification...');
    console.log('Using template:', workshop.emailTemplateAdmin);
    await emailjs.send('harishteamgng', workshop.emailTemplateAdmin, emailParams)
        .then((response) => {
            console.log('Admin email SUCCESS!', response.status, response.text);
        })
        .catch((error) => {
            console.error('Admin email FAILED:', error);
            throw error;
        });

    console.log('Both emails sent successfully!');


} catch (error) {
  console.error("❌ Email sending error:", error);
  // Payment successful hai but email fail - user ko inform karo
  alert("Payment successful! You'll receive confirmation email shortly.");
}

                // Show success message
                document.getElementById("formContainer").style.display = "none";
                document
                  .getElementById("successMessage")
                  .classList.add("active");
              },

              prefill: {
                name: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                contact: formData.phone,
              },
              theme: {
                color: "#7c3aed",
              },
            };

            const razorpay = new Razorpay(options);
            razorpay.open();

            razorpay.on("payment.failed", function () {
              alert("Payment failed. Please try again.");
              submitBtn.disabled = false;
              submitBtn.textContent = "Proceed";
            });
          } catch (error) {
            console.error("Error:", error);
            alert("Something went wrong. Please try again.");
            submitBtn.disabled = false;
            submitBtn.textContent = "Proceed";
          }
        });

      // Close modal on outside click
      document
        .getElementById("registrationModal")
        .addEventListener("click", function (e) {
          if (e.target === this) {
            closeModal();
          }
        });

      // Close fully booked modal on outside click
      document
        .getElementById("fullyBookedModal")
        .addEventListener("click", function (e) {
          if (e.target === this) {
            closeFullyBookedModal();
          }
        });

      // Close mobile menu when clicking outside
      document.addEventListener("click", function (e) {
        const mobileMenu = document.getElementById("mobileMenu");
        const hamburger = document.querySelector(".ggw-hamburger");

        if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
          mobileMenu.classList.remove("active");
          hamburger.classList.remove("active");
        }
      });

      // 🔥 INITIALIZE BOOKING SYSTEM ON PAGE LOAD
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBookingSystem);
      } else {
        initBookingSystem();
      }

// Close menu when clicking on background
document.getElementById('mobileMenu').addEventListener('click', function(e) {
  if (e.target === this) {
    toggleMobileMenu();
  }
});


































// WORKSHOP TIMELINE FUNCTIONS

// Workshop data for lazy loading + email templates
const workshopData = {
  'knee-pain': {
    name: 'Knee Pain Relief Workshop',
    description: 'Knee pain is one of the most common complaints in fitness training. We\'ll identify the root causes—improper landing mechanics, muscle imbalances, quad-dominance, ankle mobility restrictions, or poor progression. Learn evidence-based solutions including movement re-education, targeted strengthening exercises, knee-friendly modifications, and what movements to avoid. You\'ll receive a personalized assessment and action plan to train pain-free.',
    date: '30th November 2025',
    time: '10:00 AM - 12:00 PM',
    venue: 'GripGrab Studio, Lajpat Nagar',
    fee: '₹1,200',
    emailTemplateUser: 'template_kneepain_user',
    emailTemplateAdmin: 'template_kneepain_admin'
  },
  'back-pain': {
    name: 'Back Pain Solutions Workshop',
    description: 'Lower back pain affects millions of athletes and fitness enthusiasts. We\'ll break down the real causes—poor movement patterns, core weakness, tight hip flexors, spinal compression, or improper loading. Learn a biopsychosocial approach to back pain management, safe exercise progressions, mobility restoration techniques, and how to build back stronger. Discover which movements to limit, which to prioritize, and evidence-based exercises to keep you moving pain-free.',
    date: '7th December 2025',
    time: '2:00 PM - 4:00 PM',
    venue: 'GripGrab Studio, Lajpat Nagar',
    fee: '₹1,200',
    emailTemplateUser: 'template_backpain_user',
    emailTemplateAdmin: 'template_backpain_admin'
  },
  'handstand': {
    name: 'Handstand Fundamentals',
    description: 'Master the foundational skill of handstand training through systematic progressions. We\'ll break down proper hand placement, shoulder engagement, core activation, and balance techniques. Learn wrist preparation exercises, kick-up mechanics, wall-assisted drills, and freestanding holds. Build shoulder stability, body awareness, and the confidence to hold a solid handstand. Perfect for beginners to intermediate practitioners.',
    date: '14th December 2025',
    time: '3:00 PM - 5:00 PM',
    venue: 'GripGrab Studio, Lajpat Nagar',
    fee: '₹1,000',
    emailTemplateUser: 'template_handstand_user',
    emailTemplateAdmin: 'template_handstand_admin'
  },
  'trap-pain': {
    name: 'Upper Trap & Rhomboid Pain Relief',
    description: 'Upper back and neck pain from tight traps and rhomboid dysfunction is incredibly common in desk workers and athletes. We\'ll identify the root causes—poor posture, scapular dyskinesis, muscle imbalances, or overactive traps. Learn targeted stretches, self-massage techniques using tennis balls, RICE method applications, movement re-education, and strengthening exercises. Discover what activities to avoid and how to prevent future flare-ups. Leave with immediate relief strategies.',
    date: '21st December 2025',
    time: '11:00 AM - 1:00 PM',
    venue: 'GripGrab Studio, Lajpat Nagar',
    fee: '₹1,000',
    emailTemplateUser: 'template_trappain_user',
    emailTemplateAdmin: 'template_trappain_admin'
  }
};


// Global variable to store selected workshop
let selectedWorkshopData = null;

// Toggle workshop expansion
function toggleWorkshop(element) {
  const timelineItem = element.closest('.wt-timeline-item');
  const workshopId = timelineItem.getAttribute('data-workshop');
  const detailsContent = timelineItem.querySelector('.wt-details-content');
  
  // Check if already active
  const isActive = timelineItem.classList.contains('active');
  
  // Close all other workshops
  document.querySelectorAll('.wt-timeline-item').forEach(item => {
    if (item !== timelineItem) {
      item.classList.remove('active');
    }
  });
  
  // Toggle current workshop
  if (!isActive) {
    timelineItem.classList.add('active');
    
    // Lazy load content if not already loaded
    if (workshopData[workshopId] && detailsContent.children.length === 0) {
      loadWorkshopContent(workshopId, detailsContent);
    }
  } else {
    timelineItem.classList.remove('active');
  }
}

// Lazy load workshop content
function loadWorkshopContent(workshopId, container) {
  const data = workshopData[workshopId];
  
  if (!data) return;
  
  const content = `
    <p class="wt-description">${data.description}</p>
    
    <div class="wt-info-grid">
      <div class="wt-info-item">
        <span class="wt-label">📅 Date</span>
        <span class="wt-value">${data.date}</span>
      </div>
      <div class="wt-info-item">
        <span class="wt-label">🕐 Time</span>
        <span class="wt-value">${data.time}</span>
      </div>
      <div class="wt-info-item">
        <span class="wt-label">📍 Venue</span>
        <span class="wt-value">${data.venue}</span>
      </div>
      <div class="wt-info-item">
        <span class="wt-label">💰 Fee</span>
        <span class="wt-value">${data.fee}</span>
      </div>
    </div>
    
    <button class="wt-register-btn" onclick="registerWorkshop('${workshopId}')">
      Register Now
    </button>
  `;
  
  container.innerHTML = content;
}

// Register for workshop - MODIFIED
function registerWorkshop(workshopId) {
  // Store selected workshop data globally
  selectedWorkshopData = workshopData[workshopId];
  
  if (!selectedWorkshopData) {
    alert('Workshop not found!');
    return;
  }
  
  console.log('Selected Workshop:', selectedWorkshopData.name);
  
  // Update modal with workshop-specific details
  updateModalWithWorkshopDetails(selectedWorkshopData);
  
  // Open registration modal (your existing function)
  openModal();
}

// Update modal form with workshop details
function updateModalWithWorkshopDetails(workshop) {
  // Update workshop info section in modal
  const workshopInfoSection = document.querySelector('.ggw-workshop-info');
  
  if (workshopInfoSection) {
    workshopInfoSection.innerHTML = `
      <p><strong>Workshop:</strong> ${workshop.name}</p>
      <p><strong>Date:</strong> ${workshop.date}</p>
      <p><strong>Time:</strong> ${workshop.time}</p>
      <p><strong>Location:</strong> ${workshop.venue}</p>
      <p><strong>Fee:</strong> ${workshop.fee}</p>
    `;
  }
  
  // Update modal heading
  const modalHeading = document.querySelector('.ggw-modal h2');
  if (modalHeading) {
    modalHeading.textContent = `Register for ${workshop.name}`;
  }
}



















       