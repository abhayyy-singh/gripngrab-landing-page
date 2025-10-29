// DOM Elements
const navbar = document.getElementById("navbar");
const hero = document.querySelector(".hero");
const footer = document.querySelector(".footer");
const hamburger = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobileMenu");

// State variables
let heroVisible = false;
let footerVisible = false;

// Hamburger menu functionality
hamburger.addEventListener("click", () => {
  hamburger.classList.toggle("active");
  mobileMenu.classList.toggle("active");

  document.body.style.overflow = mobileMenu.classList.contains("active")
    ? "hidden"
    : "auto";
});

// Close mobile menu when clicking on a link
const mobileLinks = mobileMenu.querySelectorAll("a");
mobileLinks.forEach((link) => {
  link.addEventListener("click", () => {
    hamburger.classList.remove("active");
    mobileMenu.classList.remove("active");
    document.body.style.overflow = "auto";
  });
});

// Navbar visibility toggle function
function toggleNavbar() {
  if (footerVisible || heroVisible) {
    navbar.style.opacity = "1";
    navbar.style.pointerEvents = "auto";
    navbar.style.transform = "translateY(0)";
  } else {
    navbar.style.opacity = "0";
    navbar.style.pointerEvents = "none";
    navbar.style.transform = "translateY(-100%)";
  }
}

// Navbar scroll effect
window.addEventListener("scroll", () => {
  if (window.scrollY > 100) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
});

// Intersection observers for navbar visibility
const footerObserver = new IntersectionObserver(
  (entries) => {
    footerVisible = entries.some((entry) => entry.isIntersecting);
    toggleNavbar();
  },
  {
    threshold: 0.1,
  }
);

const heroObserver = new IntersectionObserver(
  (entries) => {
    heroVisible = entries.some((entry) => entry.isIntersecting);
    toggleNavbar();
  },
  {
    threshold: 0.2,
  }
);

// Observe hero and footer sections
footerObserver.observe(footer);
heroObserver.observe(hero);

// Timeline Animation
const timelineItems = document.querySelectorAll(".timeline-item");
const timelineProgress = document.getElementById("timelineProgress");

const timelineObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const item = entry.target;
        if (item.classList.contains("active")) {
          return;
        }
        const number = item.querySelector(".timeline-number");
        const content = item.querySelector(".timeline-content");
        const step = parseInt(item.dataset.step);

        item.classList.add("active");
        number.classList.add("active");
        content.classList.add("active");

        const progressHeight = (step / timelineItems.length) * 100;
        timelineProgress.style.height = `${progressHeight}%`;
      }
    });
  },
  {
    threshold: 0.5,
    rootMargin: "-10% 0px -10% 0px",
  }
);

// Detect mobile device
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

// Autoplay Video
const video = document.getElementById("autoPlayVideo");

if (video) {
  let userHasInteracted = false;
  
  const handleFirstInteraction = () => {
    if (!userHasInteracted) {
      userHasInteracted = true;
      video.muted = false;
      console.log('Autoplay video permanently unmuted after user interaction');
    }
  };
  
  const interactionEvents = ['click', 'touchstart', 'touchmove', 'scroll'];
  interactionEvents.forEach(eventType => {
    document.addEventListener(eventType, handleFirstInteraction, { once: true });
  });
  
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        if (!userHasInteracted) {
          video.muted = isMobile ? true : false;
        } else {
          video.muted = false;
        }
        
        video.play().catch((e) => {
          console.log("Autoplay failed:", e);
        });
      } else {
        video.pause();
      }
    },
    {
      threshold: 0.5,
    }
  );

  observer.observe(video);
}

// Observe timeline items
timelineItems.forEach((item) => {
  timelineObserver.observe(item);
});

let currentGallery = null;
let currentSlideIndex = 0;

function openGallery(gymLocation) {
  currentGallery = galleryData[gymLocation];
  currentSlideIndex = 0;

  const modal = document.getElementById("galleryModal");
  const title = document.getElementById("galleryTitle");
  const mainImage = document.getElementById("galleryMainImage");
  const currentSlideSpan = document.getElementById("currentSlide");
  const totalSlidesSpan = document.getElementById("totalSlides");

  title.textContent = currentGallery.title;
  mainImage.src = currentGallery.images[0];
  mainImage.alt = currentGallery.title;
  currentSlideSpan.textContent = "1";
  totalSlidesSpan.textContent = currentGallery.images.length;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeGallery() {
  const modal = document.getElementById("galleryModal");
  modal.classList.remove("active");
  document.body.style.overflow = "auto";
  currentGallery = null;
}

function changeSlide(direction) {
  if (!currentGallery) return;

  currentSlideIndex += direction;

  if (currentSlideIndex < 0) {
    currentSlideIndex = currentGallery.images.length - 1;
  } else if (currentSlideIndex >= currentGallery.images.length) {
    currentSlideIndex = 0;
  }

  const mainImage = document.getElementById("galleryMainImage");
  const currentSlideSpan = document.getElementById("currentSlide");

  mainImage.src = currentGallery.images[currentSlideIndex];
  currentSlideSpan.textContent = currentSlideIndex + 1;
}

// Keyboard navigation for gallery
document.addEventListener("keydown", (e) => {
  if (currentGallery) {
    if (e.key === "ArrowLeft") {
      changeSlide(-1);
    } else if (e.key === "ArrowRight") {
      changeSlide(1);
    } else if (e.key === "Escape") {
      closeGallery();
    }
  }
});

// TESTIMONIAL VIDEO CONTROLS
document.querySelectorAll(".testimonial-card").forEach((card) => {
  const video = card.querySelector("video");

  if (!video) return;

  video.setAttribute("controls", "false");
  
  if (isMobile) {
    card.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (video.paused) {
        video.setAttribute("controls", "true");
        video.muted = false;
        video.play().catch((e) => console.log("Video play failed:", e));
        
        setTimeout(() => {
          video.setAttribute("controls", "false");
        }, 1000);
      } else {
        video.setAttribute("controls", "true");
        video.pause();
        video.muted = true;
        video.currentTime = 0;
        
        setTimeout(() => {
          video.setAttribute("controls", "false");
        }, 1000);
      }
    });

    document.addEventListener("click", (e) => {
      if (!card.contains(e.target)) {
        video.setAttribute("controls", "false");
      }
    });

    video.addEventListener("play", () => {
      setTimeout(() => {
        video.setAttribute("controls", "false");
      }, 1000);
    });

    video.addEventListener("pause", () => {
      setTimeout(() => {
        video.setAttribute("controls", "false");
      }, 1000);
    });

  } else {
    card.addEventListener("mouseenter", () => {
      video.muted = false;
      video.play().catch((e) => console.log("Video play failed:", e));
    });

    card.addEventListener("mouseleave", () => {
      video.pause();
      video.muted = true;
      video.currentTime = 0;
    });
  }
});

// Scroll-based reveal animations
const animatedElements = document.querySelectorAll(
  ".animate-left, .animate-right, .animate-up, .animate-fade"
);

const revealOnScroll = (entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("show");
      observer.unobserve(entry.target);
    }
  });
};

const scrollObserver = new IntersectionObserver(revealOnScroll, {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
});

animatedElements.forEach((el) => scrollObserver.observe(el));

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));

    if (target) {
      if (mobileMenu.classList.contains("active")) {
        hamburger.classList.remove("active");
        mobileMenu.classList.remove("active");
        document.body.style.overflow = "auto";
      }

      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

// Enhanced form submission
const form = document.querySelector(".forms");
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = form.querySelector(".emailinput").value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    const submitBtn = form.querySelector(".getnotify");
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Submitting...";
    submitBtn.disabled = true;

    setTimeout(() => {
      alert(`Thank you! We'll notify you at ${email}`);
      form.reset();
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }, 1500);
  });
}

// Enhanced video loading and error handling
const videos = document.querySelectorAll("video");
videos.forEach((video) => {
  video.addEventListener("loadstart", () => {
    video.style.backgroundColor = "#1a1a1a";
  });

  video.addEventListener("canplay", () => {
    video.style.backgroundColor = "transparent";
  });

  video.addEventListener("error", (e) => {
    console.log("Video loading error:", e);
    video.style.backgroundColor = "#2a2a2a";
  });

  video.muted = true;
});

// Parallax effect for floating labels
window.addEventListener("scroll", () => {
  const scrolled = window.pageYOffset;
  const parallaxElements = document.querySelectorAll(".floating-label");

  parallaxElements.forEach((element, index) => {
    const speed = 0.3 + index * 0.1;
    const yPos = -(scrolled * speed);
    element.style.transform = `translateY(${yPos}px)`;
  });
});

// Enhanced button interactions
const buttons = document.querySelectorAll(".btn, .fbtn, .cta-button");
buttons.forEach((button) => {
  button.addEventListener("mouseenter", () => {
    button.style.transform = "translateY(-2px) scale(1.02)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "translateY(0) scale(1)";
  });

  button.addEventListener("mousedown", () => {
    button.style.transform = "translateY(0) scale(0.98)";
  });

  button.addEventListener("mouseup", () => {
    button.style.transform = "translateY(-2px) scale(1.02)";
  });

  button.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      button.style.transform = "translateY(0) scale(0.98)";
    }
  });

  button.addEventListener("keyup", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      button.style.transform = "translateY(-2px) scale(1.02)";
    }
  });
});

// Keyboard navigation improvements
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mobileMenu.classList.contains("active")) {
    hamburger.classList.remove("active");
    mobileMenu.classList.remove("active");
    document.body.style.overflow = "auto";
  }

  if (e.key === "ArrowDown" && e.ctrlKey) {
    e.preventDefault();
    window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
  }

  if (e.key === "ArrowUp" && e.ctrlKey) {
    e.preventDefault();
    window.scrollBy({ top: -window.innerHeight, behavior: "smooth" });
  }
});

// Performance optimization: Lazy loading for videos
const videoObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const video = entry.target;
        if (video.dataset.src) {
          video.src = video.dataset.src;
          video.load();
          videoObserver.unobserve(video);
        }
      }
    });
  },
  {
    rootMargin: "100px",
  }
);

videos.forEach((video) => {
  const rect = video.getBoundingClientRect();
  if (rect.top > window.innerHeight * 1.5) {
    video.dataset.src = video.src;
    video.src = "";
    videoObserver.observe(video);
  }
});

// Window load event for initial animations
window.addEventListener("load", () => {
  document.body.style.opacity = "1";

  const heroElements = document.querySelectorAll(".hero-content > *");
  heroElements.forEach((el, index) => {
    setTimeout(() => {
      el.style.animationDelay = `${index * 0.2}s`;
      el.classList.add("animate-fade-in");
    }, index * 100);
  });
});

// Resize event handler
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (window.innerWidth > 768 && mobileMenu.classList.contains("active")) {
      hamburger.classList.remove("active");
      mobileMenu.classList.remove("active");
      document.body.style.overflow = "auto";
    }

    if (currentGallery && window.innerWidth < 768) {
      closeGallery();
    }

    videos.forEach((video) => {
      if (video.videoWidth && video.videoHeight) {
        const aspectRatio = video.videoWidth / video.videoHeight;
        const containerWidth = video.parentElement.offsetWidth;
        video.style.height = `${containerWidth / aspectRatio}px`;
      }
    });
  }, 250);
});

// Initialize tooltips
const initializeTooltips = () => {
  const tooltipElements = document.querySelectorAll("[data-tooltip]");
  tooltipElements.forEach((element) => {
    element.addEventListener("mouseenter", (e) => {
      const tooltip = document.createElement("div");
      tooltip.className = "tooltip";
      tooltip.textContent = e.target.dataset.tooltip;
      document.body.appendChild(tooltip);

      const rect = e.target.getBoundingClientRect();
      tooltip.style.top = `${rect.top - 40}px`;
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
      tooltip.style.transform = "translateX(-50%)";
    });

    element.addEventListener("mouseleave", () => {
      const tooltip = document.querySelector(".tooltip");
      if (tooltip) {
        tooltip.remove();
      }
    });
  });
};

// Smooth scroll function
function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}

// Payment redirect function
function redirectToPayment() {
  window.open(
    "https://wa.me/+919971250050?text=Hey%2C%20I%20want%20to%20join%20Grip%20and%20Grab.%20What%20is%20the%20procedure%3F",
    "_blank"
  );
}

// FAQ functionality
function toggleFaq(element) {
  const faqItem = element.parentElement;
  const isActive = faqItem.classList.contains("active");

  document.querySelectorAll(".faq-item").forEach((item) => {
    item.classList.remove("active");
  });

  if (!isActive) {
    faqItem.classList.add("active");
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initializeTooltips();
  console.log("Grip&Grab website initialized successfully!");
});

// Expose gallery functions
window.openGallery = openGallery;
window.closeGallery = closeGallery;
window.changeSlide = changeSlide;

// Logo GIF control
document.addEventListener("DOMContentLoaded", function () {
  const logoImg = document.getElementById("logoBackground");
  const gifSrc = "./images/logo.gif";
  const staticSrc = "./images/logo-static.png";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  logoImg.onload = function () {
    canvas.width = this.naturalWidth;
    canvas.height = this.naturalHeight;
    ctx.drawImage(this, 0, 0);
    const staticFrame = canvas.toDataURL();

    setTimeout(() => {
      logoImg.src = staticFrame;
    }, 3000);
  };

  logoImg.onerror = function () {
    console.log("GIF loading failed, using fallback");
    if (staticSrc) {
      this.src = staticSrc;
    }
  };

  if (logoImg.complete) {
    logoImg.onload();
  }
});

function playLogoOnce() {
  const logoImg = document.getElementById("logoBackground");
  const originalSrc = logoImg.src;

  logoImg.src = "";
  logoImg.src = originalSrc + "?t=" + Date.now();

  setTimeout(() => {
    logoImg.style.opacity = "0.08";
  }, 3000);
}

document.addEventListener("visibilitychange", function () {
  if (!document.hidden) {
    // Uncomment if needed: playLogoOnce();
  }
});

/* ==================== FREE TRIAL MODAL SCRIPT ==================== */

(function() {
  'use strict';

 const CONFIG = {
  accessKey: 'ac6dfa83-49cf-4b5a-a983-1ac5e095dc37',
  
  // EmailJS Configuration
  emailJS: {
    serviceId: 'harish@teamgng',
    templateId: 'template_1k0fnrn',
    publicKey: 'wwGXMDT6ekGDIkKNg',
    recipientEmail: 'haristhenics06@gmail.com'
  },
  
  // Razorpay Configuration
  razorpay: {
    keyId: 'rzp_live_RZDqaPc9XD0...', // Your Razorpay live key
    amount: 49900 // ₹499 in paise
  }
};

  const state = {
    isOpen: false,
    isSubmitting: false,
    formType: 'free-trial'
  };

  const elements = {
    modal: null,
    overlay: null,
    closeBtn: null,
    form: null,
    submitBtn: null,
    dateInput: null,
    successMsg: null,
    errorMsg: null,
    triggers: []
  };

  function updateFormForType(formType) {
    const modalTitle = document.querySelector('.trial-modal__title');
    const modalSubtitle = document.querySelector('.trial-modal__subtitle');
    const serviceGroup = document.querySelector('.trial-form__group:has(#trialService)');
    const mediumGroup = document.querySelector('.trial-form__group:has([name="medium"])');
    
    if (formType === 'personal-training') {
      // Personal Training Form
      modalTitle.textContent = 'Book Personal Training';
      modalSubtitle.textContent = 'Choose your preferred training plan and schedule your session.';
      
      // Show service and medium fields
      if (serviceGroup) serviceGroup.style.display = 'flex';
      if (mediumGroup) mediumGroup.style.display = 'flex';
      
      const serviceDropdown = document.getElementById('trialService');
      if (serviceDropdown) {
        serviceDropdown.innerHTML = `
          <option value="" disabled selected>Select service</option>
          <optgroup label="Consultation & Programs">
            <option value="One-Time Consultation (₹4,000)">One-Time Consultation - ₹4,000</option>
            <option value="Consultation + Workout Program (₹8,000)">Consultation + Workout Program - ₹8,000</option>
            <option value="Consultation + Workout Program + Daily Guidance (₹12,000)">Consultation + Workout Program + Daily Guidance - ₹12,000</option>
          </optgroup>
          <optgroup label="Training Sessions">
            <option value="Per Session (₹3,000)">Per Session - ₹3,000</option>
            <option value="12 Sessions Package (₹30,000)">12 Sessions Package - ₹30,000 (Save ₹6K)</option>
          </optgroup>
        `;
        serviceDropdown.required = true;
      }
      
      // Make medium required
      const mediumInputs = document.querySelectorAll('[name="medium"]');
      mediumInputs.forEach(input => input.required = true);
      
    } else {
      // Free Trial Form (Original - NO dropdown, NO medium)
      modalTitle.textContent = 'Book Your Free Trial';
      modalSubtitle.textContent = 'Experience Grip & Grab for free. Choose your preferred location and time slot.';
      
      // Hide service and medium fields
      if (serviceGroup) serviceGroup.style.display = 'none';
      if (mediumGroup) mediumGroup.style.display = 'none';
      
      const serviceDropdown = document.getElementById('trialService');
      if (serviceDropdown) {
        serviceDropdown.required = false;
      }
      
      // Make medium not required
      const mediumInputs = document.querySelectorAll('[name="medium"]');
      mediumInputs.forEach(input => input.required = false);
    }
  }

  function init() {
    elements.modal = document.getElementById('trialModal');
    elements.overlay = document.querySelector('.trial-modal__overlay');
    elements.closeBtn = document.querySelector('.trial-modal__close');
    elements.form = document.getElementById('trialForm');
    elements.submitBtn = elements.form?.querySelector('.trial-form__submit');
    elements.dateInput = document.getElementById('trialDate');
    elements.successMsg = document.getElementById('trialSuccess');
    elements.errorMsg = document.getElementById('trialError');
    elements.triggers = Array.from(document.querySelectorAll('[data-trial-trigger]'));

    if (!elements.modal || !elements.form) {
      console.warn('Trial modal elements not found');
      return;
    }

    setupEventListeners();
    setupDatePicker();

    console.log('✅ Free Trial Modal initialized');
  }

  function setupEventListeners() {
    elements.triggers.forEach(trigger => {
      trigger.addEventListener('click', openModal);
    });

    if (elements.closeBtn) {
      elements.closeBtn.addEventListener('click', closeModal);
    }

    if (elements.overlay) {
      elements.overlay.addEventListener('click', closeModal);
    }

    document.addEventListener('keydown', handleEscKey);

    if (elements.form) {
      elements.form.addEventListener('submit', handleFormSubmit);
    }

    const modalContainer = elements.modal?.querySelector('.trial-modal__container');
    if (modalContainer) {
      modalContainer.addEventListener('click', (e) => e.stopPropagation());
    }
  }

  function setupDatePicker() {
    if (!elements.dateInput) return;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    elements.dateInput.setAttribute('min', todayStr);

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);
    const maxDateStr = maxDate.toISOString().split('T')[0];
    elements.dateInput.setAttribute('max', maxDateStr);

    elements.dateInput.addEventListener('change', function() {
      const selectedDate = new Date(this.value + 'T00:00:00');
      const dayOfWeek = selectedDate.getDay();

      if (dayOfWeek === 0) {
        alert('Sorry, we are closed on Sundays. Please select Monday to Saturday.');
        this.value = '';
      }
    });
  }

  function openModal(e) {
    if (e) e.preventDefault();
    
    const clickedButton = e.target.closest('[data-trial-trigger]');
    const formType = clickedButton?.getAttribute('data-form-type') || 'free-trial';
    
    state.isOpen = true;
    state.formType = formType;
    elements.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    updateFormForType(formType);
    resetForm();
    
    setTimeout(() => {
      const firstInput = elements.form.querySelector('input');
      if (firstInput) firstInput.focus();
    }, 300);
  }

  function closeModal(e) {
    if (e) e.preventDefault();
    
    state.isOpen = false;
    elements.modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function handleEscKey(e) {
    if (e.key === 'Escape' && state.isOpen) {
      closeModal();
    }
  }

  

  async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (state.isSubmitting) return;

    if (!elements.form.checkValidity()) {
      elements.form.reportValidity();
      return;
    }

    const formData = new FormData(elements.form);
    const data = Object.fromEntries(formData);

    const selectedDate = new Date(data.date + 'T00:00:00');
    if (selectedDate.getDay() === 0) {
      showError('Sundays are closed. Please select Monday to Saturday.');
      return;
    }

    try {
      state.isSubmitting = true;
      elements.submitBtn.classList.add('loading');
      elements.submitBtn.disabled = true;
      hideMessages();

      const payload = {
        access_key: CONFIG.accessKey,
        subject: state.formType === 'personal-training' 
          ? 'New Personal Training Booking - Grip & Grab'
          : 'New Free Trial Booking - Grip & Grab',
        name: data.name,
        email: data.email,
        phone: data.phone,
        location: data.location,
        date: data.date,
        time: data.time,
        medium: data.medium || 'Not specified',
        service: data.service || 'Not specified',
        message: state.formType === 'personal-training'
          ? `🎯 Personal Training Booking\n\n👤 Name: ${data.name}\n📧 Email: ${data.email}\n📞 Phone: ${data.phone}\n📍 Location: ${data.location}\n📅 Date: ${data.date}\n⏰ Time: ${data.time}\n💻 Medium: ${data.medium || 'Not specified'}\n🏋️ Service: ${data.service || 'Not specified'}`
          : `🎯 Free Trial Booking Request\n\n👤 Name: ${data.name}\n📧 Email: ${data.email}\n📞 Phone: ${data.phone}\n📍 Location: ${data.location}\n📅 Date: ${data.date}\n⏰ Time: ${data.time}`
      };

      console.log('📤 Sending booking request...');

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log('📥 Response:', result);

      if (result.success) {
        console.log('✅ Booking confirmed in database!');
        
      
        showSuccess();
        elements.form.reset();
        
        setTimeout(() => {
          closeModal();
        }, 3000);
      } else {
        throw new Error(result.message || 'Submission failed');
      }

    } catch (error) {
      console.error('❌ Error:', error);
      showError();
    } finally {
      resetSubmitButton();
    }
  }








  function showSuccess() {
    hideMessages();
    if (elements.successMsg) {
      elements.successMsg.classList.add('show');
    }
  }

  function showError(message) {
    hideMessages();
    if (elements.errorMsg) {
      if (message) {
        const errorText = elements.errorMsg.querySelector('span');
        if (errorText) errorText.textContent = message;
      }
      elements.errorMsg.classList.add('show');
    }
  }

  function hideMessages() {
    if (elements.successMsg) {
      elements.successMsg.classList.remove('show');
    }
    if (elements.errorMsg) {
      elements.errorMsg.classList.remove('show');
    }
  }

  function resetForm() {
    if (elements.form) {
      elements.form.reset();
    }
    hideMessages();
  }

  function resetSubmitButton() {
    state.isSubmitting = false;
    if (elements.submitBtn) {
      elements.submitBtn.classList.remove('loading');
      elements.submitBtn.disabled = false;
    }
  }

  window.TrialModal = {
    open: openModal,
    close: closeModal,
    isOpen: () => state.isOpen
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* ==================== PERSONAL TRAINING SECTION SCRIPT ==================== */

(function() {
  'use strict';

  function init() {
    console.log('✅ Personal Training section loaded');
    enhanceScrollBehavior();
    trackCardInteractions();
  }

  function enhanceScrollBehavior() {
    const ptSection = document.getElementById('personal-training');
    
    if (!ptSection) return;

    const hash = window.location.hash;
    if (hash === '#personal-training') {
      setTimeout(() => {
        ptSection.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  }

  function trackCardInteractions() {
    const cards = document.querySelectorAll('.pt-card');
    
    cards.forEach((card, index) => {
      card.addEventListener('mouseenter', function() {
        const cardTitle = card.querySelector('.pt-card-title')?.textContent;
        console.log(`User viewing: ${cardTitle}`);
      });
    });

    const ctaButton = document.querySelector('.pt-btn');
    if (ctaButton) {
      ctaButton.addEventListener('click', function() {
        console.log('Personal Training CTA clicked');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();





































/* ============================================
   GRIP AND GRAB - WORKSHOP REGISTRATION
   Isolated JavaScript Module with gmw- prefix
   ============================================ */

(function() {
  'use strict';

  /* ============================================
     CONFIGURATION
     ============================================ */
  const CONFIG = {
    // EmailJS Configuration
    emailJS: {
      serviceId: 'harish@teamgng',
      templateId: 'template_1k0fnrn', // TODO: Add your EmailJS template ID
      publicKey: 'wwGXMDT6ekGDIkKNg',
      recipientEmail: 'haristhenics06@gmail.com'
    },
    
    // Razorpay Configuration
    razorpay: {
      keyId: 'YOUR_RAZORPAY_KEY_ID', // TODO: Add your Razorpay Key ID after setup
      amount: 49900, // Amount in paise (₹499)
      currency: 'INR',
      name: 'Grip and Grab',
      description: 'Lower Back Pain Workshop Registration',
      image: 'https://yourdomain.com/logo.png', // Optional: Add your logo URL
      theme: {
        color: '#2a2a2a'
      }
    },
    
    // Workshop Details
    workshop: {
      title: 'Lower Back Pain Workshop',
      date: '15th November 2025',
      time: '11:00 AM - 2:00 PM',
      location: 'Delhi, Saket',
      venue: '241, 2nd Floor, Westend Marg\nNear Garden of Five Senses\nMittal Garden, Saket\nNew Delhi, Delhi 110030',
      amount: '₹499',
      businessName: 'Grip and Grab'
    },
    
    // LocalStorage Key
    storageKey: 'gmw_workshop_registrations'
  };

  /* ============================================
     DOM ELEMENTS
     ============================================ */
  const elements = {
    registerBtn: document.getElementById('gmwRegisterBtn'),
    modal: document.getElementById('gmwModal'),
    modalOverlay: document.getElementById('gmwModalOverlay'),
    modalClose: document.getElementById('gmwModalClose'),
    form: document.getElementById('gmwRegistrationForm'),
    successMessage: document.getElementById('gmwSuccessMessage'),
    successClose: document.getElementById('gmwSuccessClose'),
    
    // Form Inputs
    firstName: document.getElementById('gmwFirstName'),
    lastName: document.getElementById('gmwLastName'),
    email: document.getElementById('gmwEmail'),
    phone: document.getElementById('gmwPhone'),
    workshopDate: document.getElementById('gmwWorkshopDate'),
    terms: document.getElementById('gmwTerms'),
    submitBtn: document.getElementById('gmwSubmitBtn'),
    
    // Error Spans
    firstNameError: document.getElementById('gmwFirstNameError'),
    lastNameError: document.getElementById('gmwLastNameError'),
    emailError: document.getElementById('gmwEmailError'),
    phoneError: document.getElementById('gmwPhoneError'),
    workshopDateError: document.getElementById('gmwWorkshopDateError'),
    termsError: document.getElementById('gmwTermsError')
  };

  /* ============================================
     UTILITY FUNCTIONS
     ============================================ */
  
  // Generate unique registration ID
  function generateRegistrationId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `GMW-${timestamp}-${random}`.toUpperCase();
  }
  
  // Get current date and time
  function getCurrentDateTime() {
    const now = new Date();
    const date = now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const time = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return { date, time, timestamp: now.toISOString() };
  }
  
  // Validate email format
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Validate phone number (Indian format)
  function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  /* ============================================
     MODAL FUNCTIONS
     ============================================ */
  
  function openModal() {
    elements.modal.classList.add('gmw-modal--active');
    document.body.style.overflow = 'hidden';
    // Reset form when opening
    resetForm();
  }
  
  function closeModal() {
    elements.modal.classList.remove('gmw-modal--active');
    document.body.style.overflow = '';
  }
  
  function showSuccessMessage() {
    elements.form.style.display = 'none';
    elements.successMessage.classList.add('gmw-success-message--visible');
  }
  
  function resetForm() {
    elements.form.reset();
    elements.form.style.display = 'flex';
    elements.successMessage.classList.remove('gmw-success-message--visible');
    clearAllErrors();
  }

  /* ============================================
     VALIDATION FUNCTIONS
     ============================================ */
  
  function showError(input, errorElement, message) {
    input.classList.add('gmw-form-input--error');
    errorElement.textContent = message;
    errorElement.classList.add('gmw-form-error--visible');
  }
  
  function clearError(input, errorElement) {
    input.classList.remove('gmw-form-input--error', 'gmw-form-select--error');
    errorElement.textContent = '';
    errorElement.classList.remove('gmw-form-error--visible');
  }
  
  function clearAllErrors() {
    const inputs = [
      elements.firstName,
      elements.lastName,
      elements.email,
      elements.phone,
      elements.workshopDate
    ];
    const errors = [
      elements.firstNameError,
      elements.lastNameError,
      elements.emailError,
      elements.phoneError,
      elements.workshopDateError,
      elements.termsError
    ];
    
    inputs.forEach((input, index) => clearError(input, errors[index]));
  }
  
  function validateForm() {
    let isValid = true;
    clearAllErrors();
    
    // Validate First Name
    if (elements.firstName.value.trim() === '') {
      showError(elements.firstName, elements.firstNameError, 'First name is required');
      isValid = false;
    } else if (elements.firstName.value.trim().length < 2) {
      showError(elements.firstName, elements.firstNameError, 'First name must be at least 2 characters');
      isValid = false;
    }
    
    // Validate Last Name
    if (elements.lastName.value.trim() === '') {
      showError(elements.lastName, elements.lastNameError, 'Last name is required');
      isValid = false;
    } else if (elements.lastName.value.trim().length < 2) {
      showError(elements.lastName, elements.lastNameError, 'Last name must be at least 2 characters');
      isValid = false;
    }
    
    // Validate Email
    if (elements.email.value.trim() === '') {
      showError(elements.email, elements.emailError, 'Email address is required');
      isValid = false;
    } else if (!isValidEmail(elements.email.value.trim())) {
      showError(elements.email, elements.emailError, 'Please enter a valid email address');
      isValid = false;
    }
    
    // Validate Phone
    if (elements.phone.value.trim() === '') {
      showError(elements.phone, elements.phoneError, 'Phone number is required');
      isValid = false;
    } else if (!isValidPhone(elements.phone.value.trim())) {
      showError(elements.phone, elements.phoneError, 'Please enter a valid phone number');
      isValid = false;
    }
    
    // Validate Workshop Date
    if (elements.workshopDate.value === '') {
      showError(elements.workshopDate, elements.workshopDateError, 'Please select a workshop date');
      elements.workshopDate.classList.add('gmw-form-select--error');
      isValid = false;
    }
    
    // Validate Terms
    if (!elements.terms.checked) {
      showError(elements.terms, elements.termsError, 'You must agree to the terms and conditions');
      isValid = false;
    }
    
    return isValid;
  }

  /* ============================================
     LOCAL STORAGE FUNCTIONS
     ============================================ */
  
  function saveRegistration(registrationData) {
    try {
      // Get existing registrations
      const existingData = localStorage.getItem(CONFIG.storageKey);
      const registrations = existingData ? JSON.parse(existingData) : [];
      
      // Add new registration
      registrations.push(registrationData);
      
      // Save back to localStorage
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(registrations));
      
      console.log('✅ Registration saved to localStorage:', registrationData.registrationId);
      return true;
    } catch (error) {
      console.error('❌ Error saving registration:', error);
      return false;
    }
  }
  
  function getAllRegistrations() {
    try {
      const data = localStorage.getItem(CONFIG.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Error retrieving registrations:', error);
      return [];
    }
  }

  /* ============================================
     EXCEL EXPORT FUNCTION
     ============================================ */
  
  function exportToExcel() {
    const registrations = getAllRegistrations();
    
    if (registrations.length === 0) {
      alert('No registrations to export');
      return;
    }
    
    // Create CSV content
    const headers = [
      'Registration ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone Number',
      'Workshop Date',
      'Payment ID',
      'Amount',
      'Registration Date',
      'Registration Time',
      'Timestamp'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    registrations.forEach(reg => {
      const row = [
        reg.registrationId,
        reg.firstName,
        reg.lastName,
        reg.email,
        reg.phone,
        reg.workshopDate,
        reg.paymentId || 'N/A',
        reg.amount,
        reg.registrationDate,
        reg.registrationTime,
        reg.timestamp
      ];
      csvContent += row.map(field => `"${field}"`).join(',') + '\n';
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `GMW_Registrations_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`✅ Exported ${registrations.length} registrations to Excel`);
  }
  
  // Expose export function to window for admin use
  window.gmwExportRegistrations = exportToExcel;

  /* ============================================
     RAZORPAY PAYMENT INTEGRATION
     ============================================ */
  
  function initiatePayment(formData) {
    // Check if Razorpay is loaded
    if (typeof Razorpay === 'undefined') {
      alert('Payment gateway not loaded. Please refresh the page and try again.');
      console.error('❌ Razorpay SDK not loaded');
      return;
    }
    
    // Check if Razorpay Key is configured
    if (CONFIG.razorpay.keyId === 'YOUR_RAZORPAY_KEY_ID') {
      alert('Payment gateway not configured yet. Please contact support.');
      console.error('❌ Razorpay Key ID not configured');
      return;
    }
    
    const options = {
      key: CONFIG.razorpay.keyId,
      amount: CONFIG.razorpay.amount,
      currency: CONFIG.razorpay.currency,
      name: CONFIG.razorpay.name,
      description: CONFIG.razorpay.description,
      image: CONFIG.razorpay.image,
      
      // Prefill user data
      prefill: {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        contact: formData.phone
      },
      
      theme: CONFIG.razorpay.theme,
      
      // Payment Success Handler
      handler: function(response) {
        console.log('✅ Payment Successful:', response);
        handlePaymentSuccess(formData, response.razorpay_payment_id);
      },
      
      // Payment Modal Closed
      modal: {
        ondismiss: function() {
          console.log('⚠️ Payment cancelled by user');
          elements.submitBtn.disabled = false;
          elements.submitBtn.textContent = 'Confirm Registration - ₹499';
        }
      }
    };
    
    const razorpayInstance = new Razorpay(options);
    
    // Handle payment failure
    razorpayInstance.on('payment.failed', function(response) {
      console.error('❌ Payment Failed:', response.error);
      alert(`Payment failed: ${response.error.description}`);
      elements.submitBtn.disabled = false;
      elements.submitBtn.textContent = 'Confirm Registration - ₹499';
    });
    
    razorpayInstance.open();
  }

  /* ============================================
     PAYMENT SUCCESS HANDLER
     ============================================ */
  
  function handlePaymentSuccess(formData, paymentId) {
    const { date, time, timestamp } = getCurrentDateTime();
    const registrationId = generateRegistrationId();
    
    // Prepare registration data
    const registrationData = {
      registrationId: registrationId,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      workshopDate: formData.workshopDate,
      paymentId: paymentId,
      amount: CONFIG.workshop.amount,
      registrationDate: date,
      registrationTime: time,
      timestamp: timestamp
    };
    
    // Save to localStorage
    saveRegistration(registrationData);
    
    // Send confirmation email
    sendConfirmationEmail(registrationData);
    
    // Show success message
    showSuccessMessage();
    
    // Re-enable submit button
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = 'Confirm Registration - ₹499';
    
    console.log('✅ Registration completed:', registrationId);
  }

  /* ============================================
     EMAILJS INTEGRATION
     ============================================ */
  
  function sendConfirmationEmail(registrationData) {
    // Check if EmailJS is loaded
    if (typeof emailjs === 'undefined') {
      console.error('❌ EmailJS not loaded');
      return;
    }
    
    // Check if Template ID is configured
    if (CONFIG.emailJS.templateId === 'YOUR_EMAILJS_TEMPLATE_ID') {
      console.error('❌ EmailJS Template ID not configured');
      alert('Email confirmation service not configured. Please contact support.');
      return;
    }
    
    // Prepare email parameters
    const emailParams = {
      to_email: registrationData.email,
      to_name: `${registrationData.firstName} ${registrationData.lastName}`,
      registration_id: registrationData.registrationId,
      workshop_title: CONFIG.workshop.title,
      workshop_date: CONFIG.workshop.date,
      workshop_time: CONFIG.workshop.time,
      workshop_location: CONFIG.workshop.location,
      workshop_venue: CONFIG.workshop.venue,
      amount_paid: registrationData.amount,
      payment_id: registrationData.paymentId,
      registration_date: registrationData.registrationDate,
      registration_time: registrationData.registrationTime,
      business_name: CONFIG.workshop.businessName,
      recipient_email: CONFIG.emailJS.recipientEmail
    };
    
    // Send email using EmailJS
    emailjs.send(
      CONFIG.emailJS.serviceId,
      CONFIG.emailJS.templateId,
      emailParams,
      CONFIG.emailJS.publicKey
    )
    .then(function(response) {
      console.log('✅ Confirmation email sent successfully:', response.status);
    })
    .catch(function(error) {
      console.error('❌ Failed to send confirmation email:', error);
      // Don't show error to user as registration is already complete
    });
  }

  /* ============================================
     FORM SUBMIT HANDLER
     ============================================ */
  
  function handleFormSubmit(event) {
    event.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      console.log('⚠️ Form validation failed');
      return;
    }
    
    // Collect form data
    const formData = {
      firstName: elements.firstName.value.trim(),
      lastName: elements.lastName.value.trim(),
      email: elements.email.value.trim(),
      phone: elements.phone.value.trim(),
      workshopDate: elements.workshopDate.value
    };
    
    // Disable submit button
    elements.submitBtn.disabled = true;
    elements.submitBtn.textContent = 'Processing...';
    
    // Initiate payment
    initiatePayment(formData);
  }

  /* ============================================
     EVENT LISTENERS
     ============================================ */
  
  function initEventListeners() {
    // Open modal
    if (elements.registerBtn) {
      elements.registerBtn.addEventListener('click', openModal);
    }
    
    // Close modal
    if (elements.modalClose) {
      elements.modalClose.addEventListener('click', closeModal);
    }
    
    if (elements.modalOverlay) {
      elements.modalOverlay.addEventListener('click', closeModal);
    }
    
    // Close success message
    if (elements.successClose) {
      elements.successClose.addEventListener('click', closeModal);
    }
    
    // Form submit
    if (elements.form) {
      elements.form.addEventListener('submit', handleFormSubmit);
    }
    
    // Real-time validation on blur
    if (elements.firstName) {
      elements.firstName.addEventListener('blur', function() {
        if (this.value.trim() !== '') {
          clearError(this, elements.firstNameError);
        }
      });
    }
    
    if (elements.lastName) {
      elements.lastName.addEventListener('blur', function() {
        if (this.value.trim() !== '') {
          clearError(this, elements.lastNameError);
        }
      });
    }
    
    if (elements.email) {
      elements.email.addEventListener('blur', function() {
        if (isValidEmail(this.value.trim())) {
          clearError(this, elements.emailError);
        }
      });
    }
    
    if (elements.phone) {
      elements.phone.addEventListener('blur', function() {
        if (isValidPhone(this.value.trim())) {
          clearError(this, elements.phoneError);
        }
      });
    }
    
    if (elements.workshopDate) {
      elements.workshopDate.addEventListener('change', function() {
        if (this.value !== '') {
          clearError(this, elements.workshopDateError);
        }
      });
    }
    
    if (elements.terms) {
      elements.terms.addEventListener('change', function() {
        if (this.checked) {
          clearError(this, elements.termsError);
        }
      });
    }
    
    // ESC key to close modal
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && elements.modal.classList.contains('gmw-modal--active')) {
        closeModal();
      }
    });
  }

  /* ============================================
     INITIALIZATION
     ============================================ */
  
  function init() {
    console.log('🚀 GMW Workshop Registration Initialized');
    
     /* COMMENTED OUT - EmailJS now initialized in HTML head
    // Initialize EmailJS
    if (typeof emailjs !== 'undefined') {
      emailjs.init(CONFIG.emailJS.publicKey);
      console.log('✅ EmailJS initialized');
    } else {
      console.warn('⚠️ EmailJS not loaded. Please include EmailJS SDK.');
    }
    */

    
    // Check Razorpay SDK
    if (typeof Razorpay === 'undefined') {
      console.warn('⚠️ Razorpay SDK not loaded. Please include: https://checkout.razorpay.com/v1/checkout.js');
    } else {
      console.log('✅ Razorpay SDK loaded');
    }
    
    // Initialize event listeners
    initEventListeners();
    
    // Log admin functions
    console.log('📊 Admin Functions:');
    console.log('  - Export registrations: window.gmwExportRegistrations()');
    console.log('  - View registrations: localStorage.getItem("gmw_workshop_registrations")');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ============================================
     RAZORPAY SETUP INSTRUCTIONS
     ============================================ 
     
     1. CREATE RAZORPAY ACCOUNT:
        - Visit: https://razorpay.com/
        - Sign up for a free account
        - Complete KYC verification
     
     2. GET API KEYS:
        - Go to Dashboard → Settings → API Keys
        - Generate Test/Live keys
        - Copy "Key ID" (starts with rzp_test_ or rzp_live_)
        - Update CONFIG.razorpay.keyId above
     
     3. ADD RAZORPAY SDK:
        Add this script BEFORE gmw-workshop.js in your HTML:
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
     
     4. TESTING:
        - Use Test Mode keys for development
        - Test card: 4111 1111 1111 1111
        - Any future expiry date & CVV
     
     5. GO LIVE:
        - Replace Test Key with Live Key
        - Complete activation process in Razorpay Dashboard
     
     ============================================ */

  /* ============================================
     EMAILJS TEMPLATE SETUP
     ============================================ 
     
     1. CREATE EMAIL TEMPLATE:
        - Go to: https://dashboard.emailjs.com/
        - Click "Email Templates" → "Create New Template"
        - Template ID: Copy and update CONFIG.emailJS.templateId
     
     2. TEMPLATE CONTENT (Example):
        
        Subject: Workshop Registration Confirmed - {{registration_id}}
        
        Body:
        Dear {{to_name}},
        
        Thank you for registering for the {{workshop_title}}!
        
        REGISTRATION DETAILS:
        Registration ID: {{registration_id}}
        Payment ID: {{payment_id}}
        Amount Paid: {{amount_paid}}
        
        WORKSHOP DETAILS:
        Title: {{workshop_title}}
        Date: {{workshop_date}}
        Time: {{workshop_time}}
        Location: {{workshop_location}}
        
        VENUE:
        {{workshop_venue}}
        
        Please arrive 15 minutes before the workshop starts.
        
        Best regards,
        {{business_name}} Team
     
     3. TEMPLATE VARIABLES (must match emailParams):
        - {{to_email}}
        - {{to_name}}
        - {{registration_id}}
        - {{workshop_title}}
        - {{workshop_date}}
        - {{workshop_time}}
        - {{workshop_location}}
        - {{workshop_venue}}
        - {{amount_paid}}
        - {{payment_id}}
        - {{registration_date}}
        - {{registration_time}}
        - {{business_name}}
     
     4. ADD EMAILJS SDK:
        Add this script BEFORE gmw-workshop.js in your HTML:
        <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
     
     ============================================ */

})();














