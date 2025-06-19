// Gallery Module - Namespaced to avoid conflicts
const GalleryModule = (function () {
  ("use strict");

  // Private variables
  let locationButtons = null;
  let previewSections = null;
  let previewContainer = null;
  let closeBtn = null;
  let bgLogo = null;
  let scrollIndicator = null;
  let videoItems = null;
  let currentPlayingVideo = null;
  let isInitialized = false;

  // Configuration
  const config = {
    selectors: {
      locationButtons: ".gallery-location-btn",
      previewSections: ".gallery-preview-section",
      previewContainer: ".gallery-preview-container",
      closeBtn: "#gallery-close-preview",
      bgLogo: ".gallery-bg-logo",
      scrollIndicator: ".gallery-scroll-indicator",
      videoItems: ".gallery-video-item",
      heroSection: ".gallery-hero-section",
    },
    classes: {
      active: "active",
      visible: "visible",
    },
    animations: {
      scrollBehavior: "smooth",
      scrollBlock: "start",
    },
  };

  // Utility functions
  const utils = {
    // Safely query elements
    queryElement: function (selector) {
      return document.querySelector(selector);
    },

    queryElements: function (selector) {
      return document.querySelectorAll(selector);
    },

    // Add event listener with error handling
    addEventListenerSafe: function (element, event, handler) {
      if (element && typeof handler === "function") {
        element.addEventListener(event, handler);
        return true;
      }
      return false;
    },

    // Remove class from multiple elements
    removeClassFromElements: function (elements, className) {
      if (elements) {
        elements.forEach((el) => el.classList.remove(className));
      }
    },

    // Add class to element
    addClassToElement: function (element, className) {
      if (element) {
        element.classList.add(className);
      }
    },

    // Smooth scroll to element
    smoothScrollTo: function (element, delay = 100) {
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({
            behavior: config.animations.scrollBehavior,
            block: config.animations.scrollBlock,
          });
        }, delay);
      }
    },

    // Debounce function
    debounce: function (func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },
  };

  // DOM element initialization
  function initializeDOMElements() {
    try {
      locationButtons = utils.queryElements(config.selectors.locationButtons);
      previewSections = utils.queryElements(config.selectors.previewSections);
      previewContainer = utils.queryElement(config.selectors.previewContainer);
      closeBtn = utils.queryElement(config.selectors.closeBtn);
      bgLogo = utils.queryElement(config.selectors.bgLogo);
      scrollIndicator = utils.queryElement(config.selectors.scrollIndicator);
      videoItems = utils.queryElements(config.selectors.videoItems);

      return true;
    } catch (error) {
      console.error("Gallery: Error initializing DOM elements:", error);
      return false;
    }
  }

  // Video management functions
  function pauseAllVideos() {
    if (videoItems) {
      videoItems.forEach((item) => {
        const video = item.querySelector("video");
        if (video && !video.paused) {
          video.pause();
          video.currentTime = 0;
        }
      });
    }
    currentPlayingVideo = null;
  }

  function handleVideoClick(videoItem) {
    const video = videoItem.querySelector("video");
    const overlay = videoItem.querySelector(".gallery-video-overlay");

    if (!video) return;

    if (video.paused) {
      // Pause all other videos first
      pauseAllVideos();

      // Play this video
      video
        .play()
        .then(() => {
          currentPlayingVideo = video;
          if (overlay) {
            overlay.style.opacity = "0";
          }
        })
        .catch((error) => {
          console.warn("Gallery: Video play failed:", error);
        });
    } else {
      // Pause this video
      video.pause();
      currentPlayingVideo = null;
      if (overlay) {
        overlay.style.opacity = "1";
      }
    }
  }

  function setupVideoHandlers() {
    if (!videoItems) return;

    videoItems.forEach((item) => {
      const video = item.querySelector("video");
      const overlay = item.querySelector(".gallery-video-overlay");

      if (!video) return;

      // Click handler for video item
      utils.addEventListenerSafe(item, "click", (e) => {
        e.preventDefault();
        handleVideoClick(item);
      });

      // Video ended handler
      utils.addEventListenerSafe(video, "ended", () => {
        if (overlay) {
          overlay.style.opacity = "1";
        }
        currentPlayingVideo = null;
      });

      // Video error handler
      utils.addEventListenerSafe(video, "error", (e) => {
        console.warn("Gallery: Video error:", e);
      });

      // Mouse enter/leave for hover effects
      utils.addEventListenerSafe(item, "mouseenter", () => {
        if (video.paused && overlay) {
          overlay.style.opacity = "0.8";
        }
      });

      utils.addEventListenerSafe(item, "mouseleave", () => {
        if (video.paused && overlay) {
          overlay.style.opacity = "1";
        }
      });
    });
  }
  // Location button handlers
  function handleLocationClick(button) {
    const location = button.getAttribute("data-location");
    const targetPreview = utils.queryElement(`#gallery-${location}-preview`);

    if (!targetPreview) {
      console.warn("Gallery: Target preview not found for location:", location);
      return;
    }

    // Update button states
    utils.removeClassFromElements(locationButtons, config.classes.active);
    utils.addClassToElement(button, config.classes.active);

    // Update ARIA attributes
    locationButtons.forEach((btn) => {
      btn.setAttribute("aria-selected", "false");
    });
    button.setAttribute("aria-selected", "true");

    // Hide all preview sections
    utils.removeClassFromElements(previewSections, config.classes.active);

    // Pause all videos when switching
    pauseAllVideos();

    // Show target preview section
    utils.addClassToElement(targetPreview, config.classes.active);

    // Show preview container
    utils.addClassToElement(previewContainer, "visible");

    // Show close button
    utils.addClassToElement(closeBtn, config.classes.visible);

    // Hide scroll indicator
    if (scrollIndicator) {
      scrollIndicator.style.opacity = "0";
    }

    // Transform background logo
    if (bgLogo) {
      bgLogo.style.transform = "translate(-50%, -50%) scale(0.3)";
      bgLogo.style.opacity = "0.05";
    }

    // Scroll to preview container
    utils.smoothScrollTo(previewContainer, 300);
  }
  // Close preview functionality
  function closePreview() {
    // Hide all preview sections
    utils.removeClassFromElements(previewSections, config.classes.active);

    // Hide preview container
    previewContainer.classList.remove("visible");

    // Remove active state from buttons
    utils.removeClassFromElements(locationButtons, config.classes.active);

    // Update ARIA attributes
    locationButtons.forEach((btn) => {
      btn.setAttribute("aria-selected", "false");
    });

    // Hide close button
    if (closeBtn) {
      closeBtn.classList.remove(config.classes.visible);
    }

    // Restore scroll indicator
    if (scrollIndicator) {
      scrollIndicator.style.opacity = "0.6";
    }

    // Restore background logo
    if (bgLogo) {
      bgLogo.style.transform = "translate(-50%, -50%) scale(0.8)";
      bgLogo.style.opacity = "0.1";
    }

    // Pause all videos
    pauseAllVideos();

    // Scroll back to hero section
    const heroSection = utils.queryElement(config.selectors.heroSection);
    utils.smoothScrollTo(heroSection, 100);
  }

  // Intersection Observer for animations
  function setupIntersectionObserver() {
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.animationPlayState = "running";
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
      }
    );

    // Observe preview items for staggered animations
    const previewItems = utils.queryElements(".gallery-preview-item");
    previewItems.forEach((item) => {
      observer.observe(item);
    });
  }

  // Resize handler
  function setupResizeHandler() {
    const debouncedResize = utils.debounce(() => {
      // Recalculate any size-dependent elements if needed
      // This is a placeholder for future responsive adjustments
    }, 250);

    utils.addEventListenerSafe(window, "resize", debouncedResize);
  }

  // Performance optimization - Lazy load images
  function setupLazyLoading() {
    if ("IntersectionObserver" in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute("data-src");
            }
            imageObserver.unobserve(img);
          }
        });
      });

      // Observe images that have data-src attribute
      const lazyImages = utils.queryElements("img[data-src]");
      lazyImages.forEach((img) => imageObserver.observe(img));
    }
  }

  // Error handling and recovery
  function handleError(error, context = "Unknown") {
    console.error(`Gallery: Error in ${context}:`, error);

    // Attempt to recover from common errors
    if (context === "video" && currentPlayingVideo) {
      currentPlayingVideo.pause();
      currentPlayingVideo = null;
    }
  }

  // Add these missing functions to your gallery_js_file.js

  // Setup location button event handlers
  function setupLocationButtons() {
    if (!locationButtons) return;

    locationButtons.forEach((button) => {
      utils.addEventListenerSafe(button, "click", (e) => {
        e.preventDefault();
        handleLocationClick(button);
      });

      // Add keyboard support
      utils.addEventListenerSafe(button, "keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleLocationClick(button);
        }
      });
    });
  }

  // Setup close button event handler
  function setupCloseButton() {
    if (!closeBtn) return;

    utils.addEventListenerSafe(closeBtn, "click", (e) => {
      e.preventDefault();
      closePreview();
    });

    // Add keyboard support
    utils.addEventListenerSafe(closeBtn, "keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        closePreview();
      }
    });
  }

  // Setup keyboard shortcuts
  function setupKeyboardShortcuts() {
    utils.addEventListenerSafe(document, "keydown", (e) => {
      // Escape key to close preview
      if (e.key === "Escape") {
        const isPreviewOpen =
          closeBtn && closeBtn.classList.contains(config.classes.visible);
        if (isPreviewOpen) {
          e.preventDefault();
          closePreview();
        }
      }

      // Number keys to switch locations (1 for Lajpat, 2 for Saket)
      if (e.key === "1" && locationButtons && locationButtons[0]) {
        e.preventDefault();
        handleLocationClick(locationButtons[0]);
      }
      if (e.key === "2" && locationButtons && locationButtons[1]) {
        e.preventDefault();
        handleLocationClick(locationButtons[1]);
      }

      // Arrow keys for navigation
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const activeButton = document.querySelector(
          ".gallery-location-btn.active"
        );
        if (activeButton && locationButtons) {
          const currentIndex =
            Array.from(locationButtons).indexOf(activeButton);
          let nextIndex;

          if (e.key === "ArrowLeft") {
            nextIndex =
              currentIndex > 0 ? currentIndex - 1 : locationButtons.length - 1;
          } else {
            nextIndex =
              currentIndex < locationButtons.length - 1 ? currentIndex + 1 : 0;
          }

          if (locationButtons[nextIndex]) {
            e.preventDefault();
            handleLocationClick(locationButtons[nextIndex]);
          }
        }
      }
    });
  } 
  // Public API
  const publicAPI = {
    // Initialize the gallery
    init: function () {
      if (isInitialized) {
        console.warn("Gallery: Already initialized");
        return false;
      }

      try {
        // Initialize DOM elements
        if (!initializeDOMElements()) {
          throw new Error("Failed to initialize DOM elements");
        }

        // Setup all event handlers
        setupLocationButtons();
        setupCloseButton();
        setupVideoHandlers();
        setupKeyboardShortcuts();
        setupResizeHandler();

        // Setup performance optimizations
        setupIntersectionObserver();
        setupLazyLoading();

        isInitialized = true;
        console.log("Gallery: Initialized successfully");
        return true;
      } catch (error) {
        handleError(error, "initialization");
        return false;
      }
    },

    // Manually trigger location switch
    showLocation: function (location) {
      if (!isInitialized) {
        console.warn("Gallery: Not initialized");
        return false;
      }

      const button = utils.queryElement(`[data-location="${location}"]`);
      if (button) {
        handleLocationClick(button);
        return true;
      }
      return false;
    },

    // Close preview programmatically
    close: function () {
      if (isInitialized) {
        closePreview();
        return true;
      }
      return false;
    },

    // Get current state
    getState: function () {
      const activeButton = document.querySelector(
        ".gallery-location-btn.active"
      );
      return {
        isInitialized,
        currentLocation: activeButton
          ? activeButton.getAttribute("data-location")
          : null,
        isPreviewOpen: closeBtn
          ? closeBtn.classList.contains(config.classes.visible)
          : false,
        currentPlayingVideo: currentPlayingVideo ? true : false,
      };
    },

    // Destroy and cleanup
    destroy: function () {
      try {
        // Remove all event listeners and reset state
        pauseAllVideos();
        closePreview();

        // Reset variables
        locationButtons = null;
        previewSections = null;
        previewContainer = null;
        closeBtn = null;
        bgLogo = null;
        scrollIndicator = null;
        videoItems = null;
        currentPlayingVideo = null;
        isInitialized = false;

        console.log("Gallery: Destroyed successfully");
        return true;
      } catch (error) {
        handleError(error, "destruction");
        return false;
      }
    },
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === "loading") {
    utils.addEventListenerSafe(document, "DOMContentLoaded", publicAPI.init);
  } else {
    // DOM is already ready
    setTimeout(publicAPI.init, 0);
  }

  // Return public API
  return publicAPI;
})();

// Export for use in other modules (if needed)
if (typeof module !== "undefined" && module.exports) {
  module.exports = GalleryModule;
}
