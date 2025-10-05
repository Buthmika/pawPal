// Modal Service for creating and managing modals
class ModalService {
  constructor() {
    this.activeModals = [];
    this.modalContainer = document.getElementById('modals-container') || document.body;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModals.length > 0) {
        this.closeTopModal();
      }
    });

    // Close modal on backdrop click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeModal(e.target.closest('.modal-overlay').dataset.modalId);
      }
    });
  }

  create(options) {
    const modal = new Modal(options);
    this.activeModals.push(modal);
    return modal;
  }

  closeTopModal() {
    if (this.activeModals.length > 0) {
      const topModal = this.activeModals[this.activeModals.length - 1];
      topModal.close();
    }
  }

  closeModal(modalId) {
    const modal = this.activeModals.find(m => m.id === modalId);
    if (modal) {
      modal.close();
    }
  }

  removeModal(modal) {
    const index = this.activeModals.indexOf(modal);
    if (index > -1) {
      this.activeModals.splice(index, 1);
    }
  }
}

// Base Modal Class
class Modal {
  constructor(options = {}) {
    this.id = options.id || `modal-${Date.now()}`;
    this.title = options.title || '';
    this.content = options.content || '';
    this.size = options.size || 'md'; // sm, md, lg, xl
    this.closable = options.closable !== false;
    this.backdrop = options.backdrop !== false;
    this.onClose = options.onClose || (() => {});
    this.onShow = options.onShow || (() => {});
    
    this.element = null;
    this.overlay = null;
    this.isOpen = false;
    
    this.create();
  }

  create() {
    // Create modal overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.dataset.modalId = this.id;

    // Create modal element
    this.element = document.createElement('div');
    this.element.className = `modal modal-${this.size}`;
    this.element.innerHTML = this.getModalHTML();

    this.overlay.appendChild(this.element);
    
    // Setup event listeners
    this.setupEventListeners();
  }

  getModalHTML() {
    return `
      <div class="modal-header">
        <h3 class="modal-title">${this.title}</h3>
        ${this.closable ? '<button class="modal-close" type="button">&times;</button>' : ''}
      </div>
      <div class="modal-body">
        ${this.content}
      </div>
    `;
  }

  setupEventListeners() {
    // Close button
    if (this.closable) {
      const closeBtn = this.element.querySelector('.modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }
    }
  }

  show() {
    document.body.appendChild(this.overlay);
    document.body.style.overflow = 'hidden';
    
    // Trigger animation
    setTimeout(() => {
      this.overlay.classList.add('active');
      this.isOpen = true;
      this.onShow();
    }, 10);
  }

  close() {
    if (!this.isOpen) return;

    this.overlay.classList.remove('active');
    
    setTimeout(() => {
      if (this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      
      // Restore body scroll if this was the last modal
      if (window.modalService && window.modalService.activeModals.length <= 1) {
        document.body.style.overflow = '';
      }
      
      this.isOpen = false;
      this.onClose();
      
      // Remove from modal service
      if (window.modalService) {
        window.modalService.removeModal(this);
      }
    }, 300);
  }

  updateContent(content) {
    const body = this.element.querySelector('.modal-body');
    if (body) {
      body.innerHTML = content;
    }
  }

  updateTitle(title) {
    const titleEl = this.element.querySelector('.modal-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }
}

// Login Modal
class LoginModal extends Modal {
  constructor() {
    super({
      title: 'Welcome Back',
      content: LoginModal.getContent(),
      size: 'sm',
      id: 'login-modal'
    });

    this.setupLoginHandlers();
  }

  static getContent() {
    return `
      <form id="login-form" class="auth-form">
        <div class="form-group">
          <label for="login-email" class="form-label required">Email</label>
          <input 
            type="email" 
            id="login-email" 
            class="form-input" 
            placeholder="Enter your email"
            required
          >
          <div class="form-error" id="login-email-error"></div>
        </div>

        <div class="form-group">
          <label for="login-password" class="form-label required">Password</label>
          <input 
            type="password" 
            id="login-password" 
            class="form-input" 
            placeholder="Enter your password"
            required
          >
          <div class="form-error" id="login-password-error"></div>
        </div>

        <div class="form-group">
          <label class="checkbox">
            <input type="checkbox" id="login-remember" class="checkbox-input">
            <span class="checkbox-mark"></span>
            <span class="checkbox-label">Remember me</span>
          </label>
        </div>

        <div class="form-group">
          <button type="submit" class="btn btn-primary w-100" id="login-submit">
            <span class="btn-text">Sign In</span>
            <div class="btn-spinner" style="display: none;">
              <div class="spinner spinner-small"></div>
            </div>
          </button>
        </div>

        <div class="form-group text-center">
          <button type="button" class="btn btn-ghost" id="forgot-password">
            Forgot your password?
          </button>
        </div>

        <div class="form-divider">
          <span>Don't have an account?</span>
        </div>

        <div class="form-group">
          <button type="button" class="btn btn-outline w-100" id="show-signup">
            Create Account
          </button>
        </div>
      </form>
    `;
  }

  setupLoginHandlers() {
    const form = this.element.querySelector('#login-form');
    const submitBtn = this.element.querySelector('#login-submit');
    const emailInput = this.element.querySelector('#login-email');
    const passwordInput = this.element.querySelector('#login-password');
    const showSignupBtn = this.element.querySelector('#show-signup');
    const forgotPasswordBtn = this.element.querySelector('#forgot-password');

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleLogin();
    });

    // Show signup modal
    showSignupBtn.addEventListener('click', () => {
      this.close();
      setTimeout(() => {
        new SignupModal().show();
      }, 300);
    });

    // Forgot password
    forgotPasswordBtn.addEventListener('click', () => {
      this.showForgotPasswordModal();
    });

    // Real-time validation
    emailInput.addEventListener('blur', () => {
      this.validateEmail();
    });

    passwordInput.addEventListener('blur', () => {
      this.validatePassword();
    });

    // Clear errors on input
    emailInput.addEventListener('input', () => {
      this.clearFieldError('login-email');
    });

    passwordInput.addEventListener('input', () => {
      this.clearFieldError('login-password');
    });
  }

  async handleLogin() {
    if (!this.validateForm()) return;

    const submitBtn = this.element.querySelector('#login-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnSpinner.style.display = 'flex';

    try {
      const email = this.element.querySelector('#login-email').value;
      const password = this.element.querySelector('#login-password').value;

      const result = await authService.login(email, password);

      if (result.success) {
        window.toastService.show(result.message, 'success');
        this.close();
      } else {
        this.showFormError(result.error);
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showFormError('An unexpected error occurred');
    } finally {
      // Hide loading state
      submitBtn.disabled = false;
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
    }
  }

  validateForm() {
    let isValid = true;

    if (!this.validateEmail()) isValid = false;
    if (!this.validatePassword()) isValid = false;

    return isValid;
  }

  validateEmail() {
    const email = this.element.querySelector('#login-email').value;
    const errorEl = this.element.querySelector('#login-email-error');

    if (!email) {
      this.showFieldError('login-email', 'Email is required');
      return false;
    }

    if (!authService.validateEmail(email)) {
      this.showFieldError('login-email', 'Please enter a valid email address');
      return false;
    }

    this.clearFieldError('login-email');
    return true;
  }

  validatePassword() {
    const password = this.element.querySelector('#login-password').value;

    if (!password) {
      this.showFieldError('login-password', 'Password is required');
      return false;
    }

    this.clearFieldError('login-password');
    return true;
  }

  showFieldError(fieldId, message) {
    const input = this.element.querySelector(`#${fieldId}`);
    const errorEl = this.element.querySelector(`#${fieldId}-error`);

    if (input && errorEl) {
      input.classList.add('error');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  clearFieldError(fieldId) {
    const input = this.element.querySelector(`#${fieldId}`);
    const errorEl = this.element.querySelector(`#${fieldId}-error`);

    if (input && errorEl) {
      input.classList.remove('error');
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  }

  showFormError(message) {
    window.toastService.show(message, 'error');
  }

  showForgotPasswordModal() {
    const modal = new ForgotPasswordModal();
    modal.show();
  }
}

// Signup Modal
class SignupModal extends Modal {
  constructor() {
    super({
      title: 'Create Your Account',
      content: SignupModal.getContent(),
      size: 'md',
      id: 'signup-modal'
    });

    this.setupSignupHandlers();
  }

  static getContent() {
    return `
      <form id="signup-form" class="auth-form">
        <div class="form-grid">
          <div class="form-group">
            <label for="signup-firstName" class="form-label required">First Name</label>
            <input 
              type="text" 
              id="signup-firstName" 
              class="form-input" 
              placeholder="Enter your first name"
              required
            >
            <div class="form-error" id="signup-firstName-error"></div>
          </div>

          <div class="form-group">
            <label for="signup-lastName" class="form-label">Last Name</label>
            <input 
              type="text" 
              id="signup-lastName" 
              class="form-input" 
              placeholder="Enter your last name"
            >
            <div class="form-error" id="signup-lastName-error"></div>
          </div>
        </div>

        <div class="form-group">
          <label for="signup-email" class="form-label required">Email</label>
          <input 
            type="email" 
            id="signup-email" 
            class="form-input" 
            placeholder="Enter your email"
            required
          >
          <div class="form-error" id="signup-email-error"></div>
        </div>

        <div class="form-group">
          <label for="signup-password" class="form-label required">Password</label>
          <input 
            type="password" 
            id="signup-password" 
            class="form-input" 
            placeholder="Create a password"
            required
          >
          <div class="form-help">
            Password must be at least 8 characters with uppercase, lowercase, number, and special character
          </div>
          <div class="form-error" id="signup-password-error"></div>
        </div>

        <div class="form-group">
          <label for="signup-confirmPassword" class="form-label required">Confirm Password</label>
          <input 
            type="password" 
            id="signup-confirmPassword" 
            class="form-input" 
            placeholder="Confirm your password"
            required
          >
          <div class="form-error" id="signup-confirmPassword-error"></div>
        </div>

        <div class="form-group">
          <label for="signup-role" class="form-label required">Account Type</label>
          <select id="signup-role" class="form-select" required>
            <option value="">Select account type</option>
            <option value="pet_owner">Pet Owner</option>
            <option value="veterinarian">Veterinarian</option>
          </select>
          <div class="form-error" id="signup-role-error"></div>
        </div>

        <div class="form-group">
          <label class="checkbox">
            <input type="checkbox" id="signup-terms" class="checkbox-input" required>
            <span class="checkbox-mark"></span>
            <span class="checkbox-label">
              I agree to the <a href="/terms" target="_blank">Terms of Service</a> 
              and <a href="/privacy" target="_blank">Privacy Policy</a>
            </span>
          </label>
          <div class="form-error" id="signup-terms-error"></div>
        </div>

        <div class="form-group">
          <label class="checkbox">
            <input type="checkbox" id="signup-notifications" class="checkbox-input" checked>
            <span class="checkbox-mark"></span>
            <span class="checkbox-label">
              I want to receive email notifications about appointments and reminders
            </span>
          </label>
        </div>

        <div class="form-group">
          <button type="submit" class="btn btn-primary w-100" id="signup-submit">
            <span class="btn-text">Create Account</span>
            <div class="btn-spinner" style="display: none;">
              <div class="spinner spinner-small"></div>
            </div>
          </button>
        </div>

        <div class="form-divider">
          <span>Already have an account?</span>
        </div>

        <div class="form-group">
          <button type="button" class="btn btn-outline w-100" id="show-login">
            Sign In
          </button>
        </div>
      </form>
    `;
  }

  setupSignupHandlers() {
    const form = this.element.querySelector('#signup-form');
    const showLoginBtn = this.element.querySelector('#show-login');

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSignup();
    });

    // Show login modal
    showLoginBtn.addEventListener('click', () => {
      this.close();
      setTimeout(() => {
        new LoginModal().show();
      }, 300);
    });

    // Setup field validation
    this.setupFieldValidation();
  }

  setupFieldValidation() {
    const fields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'role'];
    
    fields.forEach(field => {
      const input = this.element.querySelector(`#signup-${field}`);
      if (input) {
        input.addEventListener('blur', () => this.validateField(field));
        input.addEventListener('input', () => this.clearFieldError(`signup-${field}`));
      }
    });

    // Terms checkbox
    const termsCheckbox = this.element.querySelector('#signup-terms');
    if (termsCheckbox) {
      termsCheckbox.addEventListener('change', () => {
        if (termsCheckbox.checked) {
          this.clearFieldError('signup-terms');
        }
      });
    }
  }

  async handleSignup() {
    if (!this.validateForm()) return;

    const submitBtn = this.element.querySelector('#signup-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnSpinner.style.display = 'flex';

    try {
      const formData = this.getFormData();
      const result = await authService.register(formData.email, formData.password, {
        role: formData.role,
        profile: {
          firstName: formData.firstName,
          lastName: formData.lastName
        },
        preferences: {
          emailNotifications: formData.notifications
        }
      });

      if (result.success) {
        window.toastService.show(result.message, 'success');
        this.close();
      } else {
        this.showFormError(result.error);
      }
    } catch (error) {
      console.error('Signup error:', error);
      this.showFormError('An unexpected error occurred');
    } finally {
      // Hide loading state
      submitBtn.disabled = false;
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
    }
  }

  getFormData() {
    return {
      firstName: this.element.querySelector('#signup-firstName').value.trim(),
      lastName: this.element.querySelector('#signup-lastName').value.trim(),
      email: this.element.querySelector('#signup-email').value.trim(),
      password: this.element.querySelector('#signup-password').value,
      confirmPassword: this.element.querySelector('#signup-confirmPassword').value,
      role: this.element.querySelector('#signup-role').value,
      terms: this.element.querySelector('#signup-terms').checked,
      notifications: this.element.querySelector('#signup-notifications').checked
    };
  }

  validateForm() {
    let isValid = true;

    const fields = ['firstName', 'email', 'password', 'confirmPassword', 'role'];
    fields.forEach(field => {
      if (!this.validateField(field)) isValid = false;
    });

    // Validate terms
    if (!this.validateTerms()) isValid = false;

    return isValid;
  }

  validateField(field) {
    const value = this.element.querySelector(`#signup-${field}`).value.trim();

    switch (field) {
      case 'firstName':
        if (!value) {
          this.showFieldError(`signup-${field}`, 'First name is required');
          return false;
        }
        break;

      case 'email':
        if (!value) {
          this.showFieldError(`signup-${field}`, 'Email is required');
          return false;
        }
        if (!authService.validateEmail(value)) {
          this.showFieldError(`signup-${field}`, 'Please enter a valid email address');
          return false;
        }
        break;

      case 'password':
        if (!value) {
          this.showFieldError(`signup-${field}`, 'Password is required');
          return false;
        }
        if (!authService.validatePassword(value)) {
          this.showFieldError(`signup-${field}`, 'Password must meet requirements');
          return false;
        }
        break;

      case 'confirmPassword':
        const password = this.element.querySelector('#signup-password').value;
        if (!value) {
          this.showFieldError(`signup-${field}`, 'Please confirm your password');
          return false;
        }
        if (value !== password) {
          this.showFieldError(`signup-${field}`, 'Passwords do not match');
          return false;
        }
        break;

      case 'role':
        if (!value) {
          this.showFieldError(`signup-${field}`, 'Please select an account type');
          return false;
        }
        break;
    }

    this.clearFieldError(`signup-${field}`);
    return true;
  }

  validateTerms() {
    const terms = this.element.querySelector('#signup-terms').checked;
    if (!terms) {
      this.showFieldError('signup-terms', 'You must agree to the Terms of Service');
      return false;
    }
    this.clearFieldError('signup-terms');
    return true;
  }

  showFieldError(fieldId, message) {
    const input = this.element.querySelector(`#${fieldId}`);
    const errorEl = this.element.querySelector(`#${fieldId}-error`);

    if (input && errorEl) {
      input.classList.add('error');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  clearFieldError(fieldId) {
    const input = this.element.querySelector(`#${fieldId}`);
    const errorEl = this.element.querySelector(`#${fieldId}-error`);

    if (input && errorEl) {
      input.classList.remove('error');
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  }

  showFormError(message) {
    window.toastService.show(message, 'error');
  }
}

// Forgot Password Modal
class ForgotPasswordModal extends Modal {
  constructor() {
    super({
      title: 'Reset Password',
      content: ForgotPasswordModal.getContent(),
      size: 'sm',
      id: 'forgot-password-modal'
    });

    this.setupForgotPasswordHandlers();
  }

  static getContent() {
    return `
      <form id="forgot-password-form" class="auth-form">
        <p>Enter your email address and we'll send you a link to reset your password.</p>
        
        <div class="form-group">
          <label for="forgot-email" class="form-label required">Email</label>
          <input 
            type="email" 
            id="forgot-email" 
            class="form-input" 
            placeholder="Enter your email"
            required
          >
          <div class="form-error" id="forgot-email-error"></div>
        </div>

        <div class="form-group">
          <button type="submit" class="btn btn-primary w-100" id="forgot-submit">
            <span class="btn-text">Send Reset Link</span>
            <div class="btn-spinner" style="display: none;">
              <div class="spinner spinner-small"></div>
            </div>
          </button>
        </div>

        <div class="form-group text-center">
          <button type="button" class="btn btn-ghost" id="back-to-login">
            Back to Login
          </button>
        </div>
      </form>
    `;
  }

  setupForgotPasswordHandlers() {
    const form = this.element.querySelector('#forgot-password-form');
    const backBtn = this.element.querySelector('#back-to-login');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleForgotPassword();
    });

    backBtn.addEventListener('click', () => {
      this.close();
      setTimeout(() => {
        new LoginModal().show();
      }, 300);
    });
  }

  async handleForgotPassword() {
    const email = this.element.querySelector('#forgot-email').value.trim();
    
    if (!authService.validateEmail(email)) {
      this.showFieldError('forgot-email', 'Please enter a valid email address');
      return;
    }

    const submitBtn = this.element.querySelector('#forgot-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnSpinner.style.display = 'flex';

    try {
      const result = await authService.resetPassword(email);

      if (result.success) {
        window.toastService.show(result.message, 'success');
        this.close();
      } else {
        this.showFieldError('forgot-email', result.error);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      this.showFieldError('forgot-email', 'An unexpected error occurred');
    } finally {
      // Hide loading state
      submitBtn.disabled = false;
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
    }
  }

  showFieldError(fieldId, message) {
    const input = this.element.querySelector(`#${fieldId}`);
    const errorEl = this.element.querySelector(`#${fieldId}-error`);

    if (input && errorEl) {
      input.classList.add('error');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }
}

// Pet Registration Modal
class PetRegistrationModal extends Modal {
  constructor(petToEdit = null) {
    super({
      title: petToEdit ? 'Edit Pet Information' : 'Add New Pet',
      content: PetRegistrationModal.getContent(petToEdit),
      size: 'lg',
      id: 'pet-registration-modal'
    });

    this.petToEdit = petToEdit;
    this.setupPetRegistrationHandlers();
  }

  static getContent(pet = null) {
    const isEdit = !!pet;
    
    return `
      <form id="pet-registration-form" class="pet-form">
        <div class="form-section">
          <h4 class="form-section-title">
            <i class="fas fa-paw"></i>
            Basic Information
          </h4>
          
          <div class="form-grid">
            <div class="form-group">
              <label for="pet-name" class="form-label required">Pet Name</label>
              <input 
                type="text" 
                id="pet-name" 
                class="form-input" 
                placeholder="Enter your pet's name"
                value="${pet?.name || ''}"
                required
                maxlength="50"
              >
              <div class="form-error" id="pet-name-error"></div>
            </div>

            <div class="form-group">
              <label for="pet-species" class="form-label required">Species</label>
              <select id="pet-species" class="form-select" required>
                <option value="">Select species</option>
                <option value="dog" ${pet?.species === 'dog' ? 'selected' : ''}>Dog</option>
                <option value="cat" ${pet?.species === 'cat' ? 'selected' : ''}>Cat</option>
                <option value="bird" ${pet?.species === 'bird' ? 'selected' : ''}>Bird</option>
                <option value="rabbit" ${pet?.species === 'rabbit' ? 'selected' : ''}>Rabbit</option>
                <option value="fish" ${pet?.species === 'fish' ? 'selected' : ''}>Fish</option>
                <option value="other" ${pet?.species === 'other' ? 'selected' : ''}>Other</option>
              </select>
              <div class="form-error" id="pet-species-error"></div>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label for="pet-breed" class="form-label required">Breed</label>
              <select id="pet-breed" class="form-select" required>
                <option value="">Select breed first</option>
              </select>
              <div class="form-error" id="pet-breed-error"></div>
            </div>

            <div class="form-group">
              <label for="pet-gender" class="form-label">Gender</label>
              <select id="pet-gender" class="form-select">
                <option value="">Select gender</option>
                <option value="male" ${pet?.gender === 'male' ? 'selected' : ''}>Male</option>
                <option value="female" ${pet?.gender === 'female' ? 'selected' : ''}>Female</option>
                <option value="unknown" ${pet?.gender === 'unknown' ? 'selected' : ''}>Unknown</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label for="pet-birthdate" class="form-label">Birth Date</label>
              <input 
                type="date" 
                id="pet-birthdate" 
                class="form-input"
                value="${pet?.birthDate || ''}"
                max="${new Date().toISOString().split('T')[0]}"
              >
              <div class="form-help">Leave empty if unknown</div>
            </div>

            <div class="form-group">
              <label for="pet-weight" class="form-label">Weight</label>
              <div class="form-input-group">
                <input 
                  type="number" 
                  id="pet-weight" 
                  class="form-input" 
                  placeholder="0"
                  value="${pet?.weight || ''}"
                  min="0.1"
                  max="200"
                  step="0.1"
                >
                <select id="pet-weight-unit" class="form-select">
                  <option value="lbs" ${pet?.weightUnit === 'lbs' || !pet ? 'selected' : ''}>lbs</option>
                  <option value="kg" ${pet?.weightUnit === 'kg' ? 'selected' : ''}>kg</option>
                </select>
              </div>
              <div class="form-help">Leave empty if unknown</div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <h4 class="form-section-title">
            <i class="fas fa-palette"></i>
            Appearance
          </h4>
          
          <div class="form-grid">
            <div class="form-group">
              <label for="pet-color" class="form-label">Color/Markings</label>
              <input 
                type="text" 
                id="pet-color" 
                class="form-input" 
                placeholder="e.g., Brown and white, Black spots"
                value="${pet?.color || ''}"
                maxlength="100"
              >
            </div>

            <div class="form-group">
              <label for="pet-microchip" class="form-label">Microchip ID</label>
              <input 
                type="text" 
                id="pet-microchip" 
                class="form-input" 
                placeholder="Microchip number (if any)"
                value="${pet?.microchipId || ''}"
                maxlength="20"
              >
            </div>
          </div>
        </div>

        <div class="form-section">
          <h4 class="form-section-title">
            <i class="fas fa-heart"></i>
            Health Information
          </h4>
          
          <div class="form-group">
            <label class="form-label">Spayed/Neutered</label>
            <div class="form-radio-group">
              <label class="radio">
                <input type="radio" name="pet-spayed" value="true" ${pet?.spayedNeutered === true ? 'checked' : ''}>
                <span class="radio-mark"></span>
                <span class="radio-label">Yes</span>
              </label>
              <label class="radio">
                <input type="radio" name="pet-spayed" value="false" ${pet?.spayedNeutered === false ? 'checked' : ''}>
                <span class="radio-mark"></span>
                <span class="radio-label">No</span>
              </label>
              <label class="radio">
                <input type="radio" name="pet-spayed" value="" ${pet?.spayedNeutered === null || pet?.spayedNeutered === undefined ? 'checked' : ''}>
                <span class="radio-mark"></span>
                <span class="radio-label">Unknown</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="pet-allergies" class="form-label">Allergies</label>
            <textarea 
              id="pet-allergies" 
              class="form-textarea" 
              placeholder="List any known allergies (food, medication, environmental)"
              rows="3"
              maxlength="500"
            >${pet?.allergies || ''}</textarea>
          </div>

          <div class="form-group">
            <label for="pet-medications" class="form-label">Current Medications</label>
            <textarea 
              id="pet-medications" 
              class="form-textarea" 
              placeholder="List current medications and dosages"
              rows="3"
              maxlength="500"
            >${pet?.medications || ''}</textarea>
          </div>

          <div class="form-group">
            <label for="pet-medical-conditions" class="form-label">Medical Conditions</label>
            <textarea 
              id="pet-medical-conditions" 
              class="form-textarea" 
              placeholder="List any chronic conditions or medical history"
              rows="3"
              maxlength="500"
            >${pet?.medicalConditions || ''}</textarea>
          </div>
        </div>

        <div class="form-section">
          <h4 class="form-section-title">
            <i class="fas fa-info-circle"></i>
            Additional Information
          </h4>
          
          <div class="form-group">
            <label for="pet-notes" class="form-label">Special Notes</label>
            <textarea 
              id="pet-notes" 
              class="form-textarea" 
              placeholder="Any additional information about your pet (behavior, preferences, etc.)"
              rows="4"
              maxlength="1000"
            >${pet?.notes || ''}</textarea>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="pet-cancel-btn">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" id="pet-submit-btn">
            <span class="btn-text">${isEdit ? 'Update Pet' : 'Register Pet'}</span>
            <div class="btn-spinner" style="display: none;">
              <div class="spinner spinner-small"></div>
            </div>
          </button>
        </div>
      </form>
    `;
  }

  setupPetRegistrationHandlers() {
    const form = this.element.querySelector('#pet-registration-form');
    const speciesSelect = this.element.querySelector('#pet-species');
    const breedSelect = this.element.querySelector('#pet-breed');
    const cancelBtn = this.element.querySelector('#pet-cancel-btn');

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handlePetRegistration();
    });

    // Cancel button
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    // Species change handler
    speciesSelect.addEventListener('change', () => {
      this.updateBreedOptions();
    });

    // Initialize breed options if species is already selected
    if (speciesSelect.value) {
      this.updateBreedOptions();
    }

    // Setup form validation
    this.setupFormValidation();
  }

  updateBreedOptions() {
    const speciesSelect = this.element.querySelector('#pet-species');
    const breedSelect = this.element.querySelector('#pet-breed');
    const species = speciesSelect.value;

    // Clear current options
    breedSelect.innerHTML = '<option value="">Select breed</option>';

    if (species) {
      const breeds = petService.getBreedsBySpecies(species);
      breeds.forEach(breed => {
        const option = document.createElement('option');
        option.value = breed;
        option.textContent = breed;
        
        // Select current breed if editing
        if (this.petToEdit && this.petToEdit.breed === breed) {
          option.selected = true;
        }
        
        breedSelect.appendChild(option);
      });
    }
  }

  setupFormValidation() {
    const fields = ['name', 'species', 'breed'];
    
    fields.forEach(field => {
      const input = this.element.querySelector(`#pet-${field}`);
      if (input) {
        input.addEventListener('blur', () => this.validateField(field));
        input.addEventListener('input', () => this.clearFieldError(`pet-${field}`));
      }
    });
  }

  async handlePetRegistration() {
    if (!this.validateForm()) return;

    const submitBtn = this.element.querySelector('#pet-submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnSpinner.style.display = 'flex';

    try {
      const petData = this.getFormData();
      let result;

      if (this.petToEdit) {
        result = await petService.updatePet(this.petToEdit.id, petData);
      } else {
        result = await petService.createPet(petData);
      }

      if (result.success) {
        window.toastService.show(result.message, 'success');
        this.close();
        
        // Refresh pets page if it's active
        if (window.pawPalApp && window.pawPalApp.currentPage === 'pets') {
          window.pawPalApp.components.pages.pets.refresh();
        }
      } else {
        this.showFormError(result.error);
      }
    } catch (error) {
      console.error('Pet registration error:', error);
      this.showFormError('An unexpected error occurred');
    } finally {
      // Hide loading state
      submitBtn.disabled = false;
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
    }
  }

  getFormData() {
    const spayedRadio = this.element.querySelector('input[name="pet-spayed"]:checked');
    let spayedValue = null;
    if (spayedRadio && spayedRadio.value !== '') {
      spayedValue = spayedRadio.value === 'true';
    }

    return {
      name: this.element.querySelector('#pet-name').value.trim(),
      species: this.element.querySelector('#pet-species').value,
      breed: this.element.querySelector('#pet-breed').value,
      gender: this.element.querySelector('#pet-gender').value || null,
      birthDate: this.element.querySelector('#pet-birthdate').value || null,
      weight: parseFloat(this.element.querySelector('#pet-weight').value) || null,
      weightUnit: this.element.querySelector('#pet-weight-unit').value,
      color: this.element.querySelector('#pet-color').value.trim() || null,
      microchipId: this.element.querySelector('#pet-microchip').value.trim() || null,
      spayedNeutered: spayedValue,
      allergies: this.element.querySelector('#pet-allergies').value.trim() || null,
      medications: this.element.querySelector('#pet-medications').value.trim() || null,
      medicalConditions: this.element.querySelector('#pet-medical-conditions').value.trim() || null,
      notes: this.element.querySelector('#pet-notes').value.trim() || null
    };
  }

  validateForm() {
    let isValid = true;

    const requiredFields = ['name', 'species', 'breed'];
    requiredFields.forEach(field => {
      if (!this.validateField(field)) isValid = false;
    });

    return isValid;
  }

  validateField(field) {
    const input = this.element.querySelector(`#pet-${field}`);
    const value = input.value.trim();

    if (!value) {
      const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
      this.showFieldError(`pet-${field}`, `${fieldName} is required`);
      return false;
    }

    this.clearFieldError(`pet-${field}`);
    return true;
  }

  showFieldError(fieldId, message) {
    const input = this.element.querySelector(`#${fieldId}`);
    const errorEl = this.element.querySelector(`#${fieldId}-error`);

    if (input && errorEl) {
      input.classList.add('error');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  clearFieldError(fieldId) {
    const input = this.element.querySelector(`#${fieldId}`);
    const errorEl = this.element.querySelector(`#${fieldId}-error`);

    if (input && errorEl) {
      input.classList.remove('error');
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  }

  showFormError(message) {
    window.toastService.show(message, 'error');
  }
}

// Export modal classes
window.ModalService = ModalService;
window.Modal = Modal;
window.LoginModal = LoginModal;
window.SignupModal = SignupModal;
window.ForgotPasswordModal = ForgotPasswordModal;
window.PetRegistrationModal = PetRegistrationModal;

// Initialize modal service
window.modalService = new ModalService();