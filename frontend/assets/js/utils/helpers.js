// Utility helper functions
const Helpers = {
  // Date and time utilities
  formatDate(date, format = APP_CONFIG.DATE_FORMATS.DISPLAY) {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    
    switch (format) {
      case 'full':
        options.weekday = 'long';
        options.month = 'long';
        break;
      case 'short':
        options.month = 'numeric';
        break;
      case 'time':
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case 'datetime':
        return d.toLocaleDateString([], options) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return d.toLocaleDateString([], options);
  },

  formatTime(time) {
    if (!time) return '';
    
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  isToday(date) {
    if (!date) return false;
    const today = new Date();
    const checkDate = new Date(date);
    return checkDate.toDateString() === today.toDateString();
  },

  isUpcoming(date) {
    if (!date) return false;
    const now = new Date();
    const checkDate = new Date(date);
    return checkDate > now;
  },

  // Validation utilities
  validateEmail(email) {
    return APP_CONFIG.VALIDATION.EMAIL_REGEX.test(email);
  },

  validatePhone(phone) {
    return APP_CONFIG.VALIDATION.PHONE_REGEX.test(phone.replace(/\s+/g, ''));
  },

  validatePassword(password) {
    if (password.length < APP_CONFIG.VALIDATION.PASSWORD_MIN_LENGTH) {
      return false;
    }
    
    if (APP_CONFIG.VALIDATION.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      return false;
    }
    
    if (APP_CONFIG.VALIDATION.PASSWORD_REQUIRE_NUMBERS && !/\d/.test(password)) {
      return false;
    }
    
    if (APP_CONFIG.VALIDATION.PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return false;
    }
    
    return true;
  },

  getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    
    if (score < 3) return { level: 'weak', text: 'Weak' };
    if (score < 5) return { level: 'medium', text: 'Medium' };
    return { level: 'strong', text: 'Strong' };
  },

  // String utilities
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  truncate(str, maxLength = 100, suffix = '...') {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
  },

  slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  // Number utilities
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  formatNumber(number, decimals = 0) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number);
  },

  // Array utilities
  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
      return groups;
    }, {});
  },

  sortBy(array, key, direction = 'asc') {
    return array.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (aVal < bVal) {
        return direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  },

  // Object utilities
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  isEmpty(obj) {
    if (obj === null || obj === undefined) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    if (typeof obj === 'string') return obj.trim().length === 0;
    return false;
  },

  // DOM utilities
  createElement(tag, className = '', innerHTML = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
  },

  addEventListenerMultiple(elements, event, handler) {
    elements.forEach(element => {
      element.addEventListener(event, handler);
    });
  },

  // File utilities
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  isValidImageType(file) {
    return APP_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type);
  },

  isValidFileSize(file) {
    return file.size <= APP_CONFIG.MAX_FILE_SIZE;
  },

  // URL utilities
  getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  },

  setQueryParam(param, value) {
    const url = new URL(window.location);
    url.searchParams.set(param, value);
    window.history.replaceState({}, '', url);
  },

  removeQueryParam(param) {
    const url = new URL(window.location);
    url.searchParams.delete(param);
    window.history.replaceState({}, '', url);
  },

  // Storage utilities
  setLocalStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  },

  getLocalStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  },

  removeLocalStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  },

  // Debounce utility
  debounce(func, wait) {
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

  // Throttle utility
  throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Random utilities
  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  },

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // Device utilities
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  isTablet() {
    return /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768;
  },

  isDesktop() {
    return !this.isMobile() && !this.isTablet();
  },

  // Animation utilities
  animateCSS(element, animationName, callback = null) {
    element.classList.add('animated', animationName);
    
    const handleAnimationEnd = () => {
      element.classList.remove('animated', animationName);
      element.removeEventListener('animationend', handleAnimationEnd);
      if (callback) callback();
    };
    
    element.addEventListener('animationend', handleAnimationEnd);
  },

  // Error handling
  handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    if (window.toastService) {
      let message = APP_CONFIG.ERROR_MESSAGES.UNKNOWN_ERROR;
      
      if (error.message) {
        message = error.message;
      } else if (typeof error === 'string') {
        message = error;
      }
      
      window.toastService.error(message);
    }
    
    // Log to external service in production
    if (APP_CONFIG.ENVIRONMENT === 'production') {
      // TODO: Implement error logging service
    }
  },

  // Loading state management
  showLoading(element, text = 'Loading...') {
    if (!element) return;
    
    element.classList.add('loading');
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.innerHTML = `
      <div class="spinner"></div>
      <span>${text}</span>
    `;
    element.appendChild(spinner);
  },

  hideLoading(element) {
    if (!element) return;
    
    element.classList.remove('loading');
    const spinner = element.querySelector('.loading-spinner');
    if (spinner) {
      spinner.remove();
    }
  }
};

// Export helpers
window.Helpers = Helpers;
window.h = Helpers; // Shorthand alias