// Toast Notification Service
class ToastService {
  constructor() {
    this.container = document.getElementById('toast-container');
    this.toasts = [];
    this.maxToasts = 5;
    
    if (!this.container) {
      this.createContainer();
    }
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', options = {}) {
    const toast = this.createToast(message, type, options);
    this.addToast(toast);
    return toast;
  }

  createToast(message, type, options) {
    const toast = {
      id: `toast-${Date.now()}`,
      message,
      type,
      duration: options.duration || this.getDefaultDuration(type),
      persistent: options.persistent || false,
      action: options.action || null,
      timestamp: new Date()
    };

    toast.element = this.createElement(toast);
    return toast;
  }

  createElement(toast) {
    const element = document.createElement('div');
    element.className = `toast toast-${toast.type}`;
    element.dataset.toastId = toast.id;
    
    element.innerHTML = `
      <div class="toast-header">
        <i class="toast-icon ${this.getIconClass(toast.type)}"></i>
        <span class="toast-message">${toast.message}</span>
        <button class="toast-close" type="button">&times;</button>
      </div>
      ${toast.action ? `
        <div class="toast-body">
          <button class="btn btn-small btn-outline toast-action" type="button">
            ${toast.action.text}
          </button>
        </div>
      ` : ''}
      <div class="toast-progress" style="animation-duration: ${toast.duration}ms;"></div>
    `;

    this.setupToastEventListeners(element, toast);
    return element;
  }

  setupToastEventListeners(element, toast) {
    // Close button
    const closeBtn = element.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.removeToast(toast.id);
    });

    // Action button
    if (toast.action) {
      const actionBtn = element.querySelector('.toast-action');
      actionBtn.addEventListener('click', () => {
        toast.action.callback();
        this.removeToast(toast.id);
      });
    }

    // Auto-remove timer (if not persistent)
    if (!toast.persistent && toast.duration > 0) {
      setTimeout(() => {
        this.removeToast(toast.id);
      }, toast.duration);
    }
  }

  addToast(toast) {
    // Remove excess toasts if max limit reached
    while (this.toasts.length >= this.maxToasts) {
      const oldestToast = this.toasts[0];
      this.removeToast(oldestToast.id);
    }

    // Add to array
    this.toasts.push(toast);

    // Add to DOM
    this.container.appendChild(toast.element);

    // Trigger show animation
    setTimeout(() => {
      toast.element.classList.add('show');
    }, 10);
  }

  removeToast(toastId) {
    const toastIndex = this.toasts.findIndex(t => t.id === toastId);
    if (toastIndex === -1) return;

    const toast = this.toasts[toastIndex];
    
    // Remove show class to trigger hide animation
    toast.element.classList.remove('show');

    // Remove from DOM after animation
    setTimeout(() => {
      if (toast.element.parentNode) {
        toast.element.parentNode.removeChild(toast.element);
      }
      
      // Remove from array
      this.toasts.splice(toastIndex, 1);
    }, 300);
  }

  removeAllToasts() {
    this.toasts.forEach(toast => {
      this.removeToast(toast.id);
    });
  }

  getIconClass(type) {
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };
    return icons[type] || icons.info;
  }

  getDefaultDuration(type) {
    const durations = {
      success: 4000,
      error: 0, // Persistent by default
      warning: 6000,
      info: 5000
    };
    return durations[type] || 5000;
  }

  // Convenience methods
  success(message, options = {}) {
    return this.show(message, 'success', options);
  }

  error(message, options = {}) {
    return this.show(message, 'error', { persistent: true, ...options });
  }

  warning(message, options = {}) {
    return this.show(message, 'warning', options);
  }

  info(message, options = {}) {
    return this.show(message, 'info', options);
  }

  // Show toast with action button
  showWithAction(message, type, actionText, actionCallback, options = {}) {
    return this.show(message, type, {
      ...options,
      action: {
        text: actionText,
        callback: actionCallback
      }
    });
  }

  // Show confirmation toast
  showConfirmation(message, onConfirm, onCancel = null) {
    const toast = this.show(message, 'warning', {
      persistent: true,
      action: {
        text: 'Confirm',
        callback: onConfirm
      }
    });

    // Add cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-small btn-ghost toast-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      if (onCancel) onCancel();
      this.removeToast(toast.id);
    });

    const actionBtn = toast.element.querySelector('.toast-action');
    actionBtn.parentNode.appendChild(cancelBtn);

    return toast;
  }
}

// Export and initialize
window.ToastService = ToastService;
window.toastService = new ToastService();