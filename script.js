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

  // Prevent scrolling when menu is open
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

        // Activate current item
        item.classList.add("active");
        number.classList.add("active");
        content.classList.add("active");

        // Update progress bar
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
// Detect mobile device (GLOBAL - keep as is)
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

// Vimeo Player for Embedded Video
let vimeoPlayer;
let userHasInteracted = false;

// Initialize Vimeo Player (runs when script loads)
function initVimeoPlayer() {
  const videoElement = document.getElementById('autoPlayVideo');
  
  // Check if element exists
  if (!videoElement) {
    console.log('Video element not found');
    return;
  }
  
  // Create Vimeo Player instance
  vimeoPlayer = new Vimeo.Player(videoElement);
  
  // One-time user interaction handler
  const handleFirstInteraction = () => {
    if (!userHasInteracted) {
      userHasInteracted = true;
      // Permanently unmute video after first interaction
      vimeoPlayer.setMuted(false);
      vimeoPlayer.setVolume(1);
      console.log('Autoplay video permanently unmuted after user interaction');
    }
  };
  
  // Add event listeners for first user interaction
  const interactionEvents = ['click', 'touchstart', 'touchmove', 'scroll'];
  interactionEvents.forEach(eventType => {
    document.addEventListener(eventType, handleFirstInteraction, { once: true });
  });
  
  // Intersection Observer - same logic as before
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        // Video comes into view - play
        if (!userHasInteracted) {
          // Desktop: Always unmuted, Mobile: Muted until first interaction
          if (isMobile) {
            vimeoPlayer.setMuted(true);
          } else {
            vimeoPlayer.setMuted(false);
            vimeoPlayer.setVolume(1);
          }
        } else {
          // After user interaction - always unmuted
          vimeoPlayer.setMuted(false);
          vimeoPlayer.setVolume(1);
        }
        
        vimeoPlayer.play().catch(err => {
          console.log('Autoplay blocked:', err);
        });
        console.log('Video playing');
      } else {
        // Video goes out of view - pause (keep mute state)
        vimeoPlayer.pause();
        console.log('Video paused');
      }
    },
    {
      threshold: 0.5,
    }
  );

  observer.observe(videoElement);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVimeoPlayer);
} else {
  // DOM already loaded
  initVimeoPlayer();
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

// TESTIMONIAL VIMEO VIDEOS - Mobile & Desktop
function initTestimonialVimeos() {
  const testimonialCards = document.querySelectorAll(".testimonial-card");
  
  if (testimonialCards.length === 0) return;
  
  testimonialCards.forEach((card) => {
    const iframe = card.querySelector("iframe.testimonial-vimeo");
    
    if (!iframe) return;
    
    const player = new Vimeo.Player(iframe);
    let isPlaying = false;
    
    if (isMobile) {
      // Mobile: Click anywhere on card to play/pause
      card.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        player.getPaused().then(paused => {
          if (paused) {
            // Play with sound
            player.setMuted(false);
            player.setVolume(1);
            player.play();
            isPlaying = true;
            console.log('Testimonial playing');
          } else {
            // Pause and reset
            player.pause();
            player.setCurrentTime(0);
            player.setMuted(true);
            isPlaying = false;
            console.log('Testimonial paused');
          }
        }).catch(err => {
          console.log('Testimonial control error:', err);
        });
      });
      
    } else {
      // Desktop: Hover to play/pause
      card.addEventListener("mouseenter", () => {
        player.setMuted(false);
        player.setVolume(1);
        player.play().catch(err => {
          console.log('Testimonial autoplay blocked:', err);
        });
        isPlaying = true;
      });
      
      card.addEventListener("mouseleave", () => {
        player.pause();
        player.setCurrentTime(0);
        player.setMuted(true);
        isPlaying = false;
      });
    }
  });
}

// Initialize testimonials after DOM loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTestimonialVimeos);
} else {
  initTestimonialVimeos();
}

// Scroll-based reveal animations
const animatedElements = document.querySelectorAll(
  ".animate-left, .animate-right, .animate-up, .animate-fade"
);

const revealOnScroll = (entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("show");
      observer.unobserve(entry.target); // Stop observing once revealed
    }
  });
};

const scrollObserver = new IntersectionObserver(revealOnScroll, {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
});

// Observe all animated elements
animatedElements.forEach((el) => scrollObserver.observe(el));

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));

    if (target) {
      // Close mobile menu if open
      if (mobileMenu.classList.contains("active")) {
        hamburger.classList.remove("active");
        mobileMenu.classList.remove("active");
        document.body.style.overflow = "auto";
      }

      // Smooth scroll to target
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

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    // Add loading state
    const submitBtn = form.querySelector(".getnotify");
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Submitting...";
    submitBtn.disabled = true;

    // Simulate API call
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
  // Loading state
  video.addEventListener("loadstart", () => {
    video.style.backgroundColor = "#1a1a1a";
  });

  // Loaded state
  video.addEventListener("canplay", () => {
    video.style.backgroundColor = "transparent";
  });

  // Error handling
  video.addEventListener("error", (e) => {
    console.log("Video loading error:", e);
    video.style.backgroundColor = "#2a2a2a";
  });

  // Ensure videos are muted initially
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
  // Mouse interactions
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

  // Keyboard interactions
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
  // Close mobile menu with Escape key
  if (e.key === "Escape" && mobileMenu.classList.contains("active")) {
    hamburger.classList.remove("active");
    mobileMenu.classList.remove("active");
    document.body.style.overflow = "auto";
  }

  // Navigation with arrow keys (optional enhancement)
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

// Apply lazy loading to videos that are not immediately visible
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
  // Fade in the body
  document.body.style.opacity = "1";

  // Stagger animation for hero elements
  const heroElements = document.querySelectorAll(".hero-content > *");
  heroElements.forEach((el, index) => {
    setTimeout(() => {
      el.style.animationDelay = `${index * 0.2}s`;
      el.classList.add("animate-fade-in");
    }, index * 100);
  });
});

// Resize event handler for responsive adjustments
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // Close mobile menu on resize to larger screen
    if (window.innerWidth > 768 && mobileMenu.classList.contains("active")) {
      hamburger.classList.remove("active");
      mobileMenu.classList.remove("active");
      document.body.style.overflow = "auto";
    }

    // Close gallery on resize
    if (currentGallery && window.innerWidth < 768) {
      closeGallery();
    }

    // Recalculate video dimensions if needed
    videos.forEach((video) => {
      if (video.videoWidth && video.videoHeight) {
        // Maintain aspect ratio
        const aspectRatio = video.videoWidth / video.videoHeight;
        const containerWidth = video.parentElement.offsetWidth;
        video.style.height = `${containerWidth / aspectRatio}px`;
      }
    });
  }, 250);
});


// Initialize tooltips or additional features if needed
const initializeTooltips = () => {
  const tooltipElements = document.querySelectorAll("[data-tooltip]");
  tooltipElements.forEach((element) => {
    element.addEventListener("mouseenter", (e) => {
      // Create and show tooltip
      const tooltip = document.createElement("div");
      tooltip.className = "tooltip";
      tooltip.textContent = e.target.dataset.tooltip; 
      document.body.appendChild(tooltip);

      // Position tooltip
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
  // Replace with your actual payment gateway URL
  window.open(
    "https://wa.me/+919971250050?text=Hey%2C%20I%20want%20to%20join%20Grip%20and%20Grab.%20What%20is%20the%20procedure%3F",
    "_blank"
  );
  // Or for external payment gateway:
  // window.open('https://your-payment-gateway.com', '_blank');
}

// FAQ functionality
function toggleFaq(element) {
  const faqItem = element.parentElement;
  const isActive = faqItem.classList.contains("active");

  // Close all other FAQ items
  document.querySelectorAll(".faq-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Toggle current item
  if (!isActive) {
    faqItem.classList.add("active");
  }
}

// Initialize additional features
document.addEventListener("DOMContentLoaded", () => {
  initializeTooltips();

  // Add any other initialization code here
  console.log("Grip&Grab website initialized successfully!");
});

// Expose gallery functions to global scope for onclick handlers
window.openGallery = openGallery;
window.closeGallery = closeGallery;
window.changeSlide = changeSlide;

// Logo GIF control - One time play on load
document.addEventListener("DOMContentLoaded", function () {
  const logoImg = document.getElementById("logoBackground");
  const gifSrc = "./images/logo.gif";
  const staticSrc = "./images/logo-static.png"; // fallback static image

  // Check if we have a static version, otherwise create one
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  logoImg.onload = function () {
    // Create static version from first frame
    canvas.width = this.naturalWidth;
    canvas.height = this.naturalHeight;
    ctx.drawImage(this, 0, 0);
    const staticFrame = canvas.toDataURL();

    // Play GIF once, then switch to static
    setTimeout(() => {
      logoImg.src = staticFrame;
    }, 3000); // Adjust timing based on your GIF duration
  };

  // Error handling for iOS/mobile
  logoImg.onerror = function () {
    console.log("GIF loading failed, using fallback");
    if (staticSrc) {
      this.src = staticSrc;
    }
  };

  // Ensure proper loading
  if (logoImg.complete) {
    logoImg.onload();
  }
});

// Alternative method - if you want more control
function playLogoOnce() {
  const logoImg = document.getElementById("logoBackground");
  const originalSrc = logoImg.src;

  // Force reload GIF to play once
  logoImg.src = "";
  logoImg.src = originalSrc + "?t=" + Date.now();

  // Stop after one cycle (adjust timeout as needed)
  setTimeout(() => {
    logoImg.style.opacity = "0.08"; // Make it more subtle after play
  }, 3000);
}

// Optional: Play logo animation on page focus (if user comes back to tab)
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) {
    // Uncomment if you want logo to play when user returns
    // playLogoOnce();
  }
});