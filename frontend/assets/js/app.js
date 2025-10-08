// Main Application Controller
class PawPalApp {
  constructor() {
    this.initialized = false;
    this.currentPage = 'home';
    this.components = {};
    this.services = {};
    
    this.init();
  }

  async init() {
    try {
      // Show loading screen
      this.showLoading();

      // Initialize services
      await this.initializeServices();

      // Setup event listeners
      this.setupEventListeners();

      // Initialize components
      this.initializeComponents();

      // Setup navigation
      this.setupNavigation();

      // Setup auth state listener
      this.setupAuthStateListener();

      // Initialize current page
      this.initializePage();

      // Hide loading screen
      setTimeout(() => {
        this.hideLoading();
        this.initialized = true;
      }, 1500);

      console.log('PawPal App initialized successfully');
    } catch (error) {
      console.error('App initialization error:', error);
      this.hideLoading();
      this.showError('Failed to initialize application. Please refresh the page.');
    }
  }

  // Initialize services
  async initializeServices() {
    // Wait for auth service to initialize
    await authService.init();
    this.services.auth = authService;

    // Initialize other services
    this.services.toast = new ToastService();
    this.services.modal = new ModalService();
  }

  // Setup event listeners
  setupEventListeners() {
    // Navigation clicks
    document.addEventListener('click', (e) => {
      const navLink = e.target.closest('[data-page]');
      if (navLink) {
        e.preventDefault();
        const page = navLink.dataset.page;
        this.navigateToPage(page);
      }

      // Auth buttons
      if (e.target.id === 'login-btn' || e.target.id === 'hero-login') {
        e.preventDefault();
        this.showLoginModal();
      }

      if (e.target.id === 'signup-btn' || e.target.id === 'hero-signup' || e.target.id === 'cta-signup') {
        e.preventDefault();
        this.showSignupModal();
      }

      if (e.target.id === 'logout-btn') {
        e.preventDefault();
        this.handleLogout();
      }

      // User menu toggle
      if (e.target.closest('#user-menu-trigger')) {
        e.preventDefault();
        this.toggleUserMenu();
      }

      // Mobile navigation toggle
      if (e.target.closest('#nav-toggle')) {
        e.preventDefault();
        this.toggleMobileNav();
      }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#user-menu')) {
        this.closeUserMenu();
      }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      const page = e.state?.page || this.getPageFromURL();
      this.navigateToPage(page, false);
    });

    // Handle page visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.handlePageVisible();
      }
    });

    // Handle online/offline events
    window.addEventListener('online', () => {
      this.services.toast.show('Connection restored', 'success');
      this.handleOnlineStateChange(true);
    });

    window.addEventListener('offline', () => {
      this.services.toast.show('No internet connection', 'warning');
      this.handleOnlineStateChange(false);
    });
  }

  // Initialize components
  initializeComponents() {
    this.components = {
      navigation: new NavigationComponent(),
      pages: {
        home: new HomePageComponent(),
        dashboard: new DashboardComponent(),
        pets: new PetsComponent(),
        appointments: new AppointmentsComponent(),
        vets: new VetsComponent()
      }
    };
  }

  // Setup navigation
  setupNavigation() {
    // Update navigation based on current URL
    const currentPage = this.getPageFromURL();
    if (currentPage) {
      this.navigateToPage(currentPage, false);
    }
  }

  // Setup auth state listener
  setupAuthStateListener() {
    authService.addAuthStateListener((user, role) => {
      this.updateUIForAuthState(user, role);
    });
  }

  // Initialize current page
  initializePage() {
    const page = this.getPageFromURL();
    if (page && this.components.pages[page]) {
      this.components.pages[page].init();
    }
  }

  // Get page from URL
  getPageFromURL() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return 'home';
    return path.substring(1); // Remove leading slash
  }

  // Navigate to page
  navigateToPage(page, updateHistory = true) {
    if (!this.components.pages[page]) {
      console.warn(`Page "${page}" not found`);
      return;
    }

    // Check if user has access to this page
    if (!this.hasPageAccess(page)) {
      this.showLoginModal();
      return;
    }

    // Hide current page
    this.hideAllPages();

    // Show target page
    this.showPage(page);

    // Update URL
    if (updateHistory) {
      const url = page === 'home' ? '/' : `/${page}`;
      history.pushState({ page }, '', url);
    }

    // Update navigation
    this.updateNavigation(page);

    // Initialize page component
    if (this.components.pages[page]) {
      this.components.pages[page].init();
    }

    this.currentPage = page;

    // Close mobile nav if open
    this.closeMobileNav();
  }

  // Check if user has access to page
  hasPageAccess(page) {
    const publicPages = ['home'];
    const authRequiredPages = ['dashboard', 'pets', 'appointments', 'vets'];
    const adminPages = ['admin'];

    if (publicPages.includes(page)) {
      return true;
    }

    if (!authService.isAuthenticated() && authRequiredPages.includes(page)) {
      return false;
    }

    if (adminPages.includes(page) && !authService.isAdmin()) {
      return false;
    }

    return true;
  }

  // Hide all pages
  hideAllPages() {
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });
  }

  // Show specific page
  showPage(page) {
    const pageElement = document.getElementById(`${page}-page`);
    if (pageElement) {
      pageElement.classList.add('active');
    }
  }

  // Update navigation active state
  updateNavigation(page) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    const activeLink = document.querySelector(`[data-page="${page}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }

  // Update UI based on auth state
  updateUIForAuthState(user, role) {
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');

    if (user) {
      // Show user menu, hide auth buttons
      authButtons.style.display = 'none';
      userMenu.style.display = 'block';

      // Update user info
      this.updateUserInfo(user, role);

      // Show/hide navigation items based on role
      this.updateNavigationForRole(role);

      // Redirect to dashboard if on home page
      if (this.currentPage === 'home') {
        this.navigateToPage('dashboard');
      }
    } else {
      // Show auth buttons, hide user menu
      authButtons.style.display = 'flex';
      userMenu.style.display = 'none';

      // Redirect to home if on protected page
      const publicPages = ['home'];
      if (!publicPages.includes(this.currentPage)) {
        this.navigateToPage('home');
      }
    }
  }

  // Update user info in UI
  updateUserInfo(user, role) {
    const userName = document.querySelector('.user-name');
    const userRole = document.querySelector('.user-role');
    const userAvatar = document.querySelector('.user-avatar i');

    if (userName) {
      const displayName = user.profile?.firstName 
        ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim()
        : user.email.split('@')[0];
      userName.textContent = displayName;
    }

    if (userRole) {
      const roleLabels = {
        [USER_ROLES.PET_OWNER]: 'Pet Owner',
        [USER_ROLES.VETERINARIAN]: 'Veterinarian',
        [USER_ROLES.ADMIN]: 'Administrator'
      };
      userRole.textContent = roleLabels[role] || 'User';
    }

    // Update avatar based on role
    if (userAvatar) {
      const roleIcons = {
        [USER_ROLES.PET_OWNER]: 'fas fa-user',
        [USER_ROLES.VETERINARIAN]: 'fas fa-user-md',
        [USER_ROLES.ADMIN]: 'fas fa-user-shield'
      };
      userAvatar.className = roleIcons[role] || 'fas fa-user';
    }
  }

  // Update navigation based on user role
  updateNavigationForRole(role) {
    const vetOnlyItems = document.querySelectorAll('[data-role="veterinarian"]');
    const adminOnlyItems = document.querySelectorAll('[data-role="admin"]');

    // Show/hide veterinarian items
    vetOnlyItems.forEach(item => {
      item.style.display = role === USER_ROLES.VETERINARIAN || role === USER_ROLES.ADMIN ? 'block' : 'none';
    });

    // Show/hide admin items
    adminOnlyItems.forEach(item => {
      item.style.display = role === USER_ROLES.ADMIN ? 'block' : 'none';
    });
  }

  // Show login modal
  showLoginModal() {
    const modal = new LoginModal();
    modal.show();
  }

  // Show signup modal
  showSignupModal() {
    const modal = new SignupModal();
    modal.show();
  }

  // Handle logout
  async handleLogout() {
    try {
      const result = await authService.logout();
      if (result.success) {
        this.services.toast.show(result.message, 'success');
        this.navigateToPage('home');
      } else {
        this.services.toast.show(result.error, 'error');
      }
    } catch (error) {
      console.error('Logout error:', error);
      this.services.toast.show('Failed to logout', 'error');
    }
  }

  // Toggle user menu
  toggleUserMenu() {
    const userMenu = document.getElementById('user-menu');
    userMenu.classList.toggle('open');
  }

  // Close user menu
  closeUserMenu() {
    const userMenu = document.getElementById('user-menu');
    userMenu.classList.remove('open');
  }

  // Toggle mobile navigation
  toggleMobileNav() {
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');
    
    navMenu.classList.toggle('open');
    navToggle.classList.toggle('active');
  }

  // Close mobile navigation
  closeMobileNav() {
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');
    
    navMenu.classList.remove('open');
    navToggle.classList.remove('active');
  }

  // Show loading screen
  showLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'flex';
    }
  }

  // Hide loading screen
  hideLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
        loadingScreen.classList.remove('fade-out');
      }, 500);
    }
  }

  // Show error message
  showError(message) {
    this.services.toast.show(message, 'error');
  }

  // Handle page becoming visible
  handlePageVisible() {
    // Refresh data if needed
    if (this.initialized && authService.isAuthenticated()) {
      // Refresh current page data
      if (this.components.pages[this.currentPage]?.refresh) {
        this.components.pages[this.currentPage].refresh();
      }
    }
  }

  // Handle online/offline state changes
  handleOnlineStateChange(isOnline) {
    // Update UI to indicate online/offline state
    document.body.classList.toggle('offline', !isOnline);
    
    // Sync data when coming back online
    if (isOnline && this.initialized) {
      // Trigger data sync if needed
      this.syncDataWhenOnline();
    }
  }

  // Sync data when coming back online
  async syncDataWhenOnline() {
    try {
      // Implement data synchronization logic
      console.log('Syncing data after coming online...');
    } catch (error) {
      console.error('Data sync error:', error);
    }
  }

  // Get app instance
  static getInstance() {
    if (!window.pawPalApp) {
      window.pawPalApp = new PawPalApp();
    }
    return window.pawPalApp;
  }
}

// Navigation Component
class NavigationComponent {
  constructor() {
    this.init();
  }

  init() {
    // Navigation is initialized in main app
  }
}

// Home Page Component
class HomePageComponent {
  constructor() {
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    
    // Initialize home page functionality
    this.setupAnimations();
    this.setupCTAButtons();
    
    this.initialized = true;
  }

  setupAnimations() {
    // Add scroll animations for sections
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, observerOptions);

    // Observe sections
    document.querySelectorAll('.features .feature-card, .steps-container .step').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });
  }

  setupCTAButtons() {
    // CTA buttons are handled in main app click handler
  }
}

// Placeholder components for other pages
class DashboardComponent {
  init() {
    console.log('Dashboard component initialized');
  }
}

class PetsComponent {
  constructor() {
    this.pets = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    console.log('Pets component initialized');
    this.setupEventListeners();
    await this.loadPets();
    this.initialized = true;
  }

  setupEventListeners() {
    // Add pet button
    const addPetBtn = document.getElementById('add-pet-btn');
    if (addPetBtn) {
      addPetBtn.addEventListener('click', () => {
        this.showAddPetModal();
      });
    }
  }

  showAddPetModal() {
    const modal = new PetRegistrationModal();
    modal.show();
  }

  async loadPets() {
    try {
      const petsContent = document.querySelector('.pets-content');
      if (!petsContent) return;

      // Show loading state
      petsContent.innerHTML = this.getLoadingHTML();

      // Load pets from service
      const result = await petService.getUserPets();
      
      if (result.success) {
        this.pets = result.data;
        this.renderPets();
      } else {
        console.warn('Failed to load pets from API:', result.error);
        // For now, show empty state instead of error to allow adding pets
        this.pets = [];
        this.renderPets();
        // Show a toast notification about the connection issue
        if (window.toastService) {
          window.toastService.warning('Unable to load existing pets. You can still add new ones.', { duration: 5000 });
        }
      }
    } catch (error) {
      console.error('Load pets error:', error);
      // Show empty state to allow adding pets
      this.pets = [];
      this.renderPets();
      if (window.toastService) {
        window.toastService.warning('Connection issue. You can still add pets.', { duration: 5000 });
      }
    }
  }

  renderPets() {
    const petsContent = document.querySelector('.pets-content');
    if (!petsContent) return;

    if (this.pets.length === 0) {
      petsContent.innerHTML = this.getEmptyStateHTML();
    } else {
      petsContent.innerHTML = this.getPetsListHTML();
      this.setupPetEventListeners();
    }
  }

  getLoadingHTML() {
    return `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Loading your pets...</p>
      </div>
    `;
  }

  getEmptyStateHTML() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-paw"></i>
        </div>
        <h3>No Pets Registered</h3>
        <p>Start by adding your first pet to keep track of their health and appointments.</p>
        <button class="btn btn-primary" onclick="window.pawPalApp.components.pages.pets.showAddPetModal()">
          <i class="fas fa-plus"></i>
          Add Your First Pet
        </button>
      </div>
    `;
  }

  getPetsListHTML() {
    return `
      <div class="pets-grid">
        ${this.pets.map(pet => this.getPetCardHTML(pet)).join('')}
      </div>
    `;
  }

  getPetCardHTML(pet) {
    const age = pet.birthDate ? petService.calculateAge(pet.birthDate) : 'Unknown age';
    const weight = pet.weight ? petService.formatWeight(pet.weight, pet.weightUnit) : '';
    const icon = petService.getPetIcon(pet.species);

    return `
      <div class="pet-card" data-pet-id="${pet.id}">
        <div class="pet-card-header">
          <div class="pet-avatar">
            <i class="${icon}"></i>
          </div>
          <div class="pet-info">
            <h3 class="pet-name">${pet.name}</h3>
            <p class="pet-breed">${pet.breed}</p>
          </div>
          <div class="pet-menu">
            <button class="pet-menu-btn" data-pet-id="${pet.id}">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="pet-menu-dropdown" id="pet-menu-${pet.id}">
              <button class="dropdown-item edit-pet-btn" data-pet-id="${pet.id}">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button class="dropdown-item view-health-btn" data-pet-id="${pet.id}">
                <i class="fas fa-heart"></i> Health Records
              </button>
              <button class="dropdown-item delete-pet-btn" data-pet-id="${pet.id}">
                <i class="fas fa-trash"></i> Remove
              </button>
            </div>
          </div>
        </div>
        
        <div class="pet-card-body">
          <div class="pet-details">
            <div class="pet-detail">
              <span class="detail-label">Species:</span>
              <span class="detail-value">${pet.species.charAt(0).toUpperCase() + pet.species.slice(1)}</span>
            </div>
            <div class="pet-detail">
              <span class="detail-label">Age:</span>
              <span class="detail-value">${age}</span>
            </div>
            ${weight ? `
            <div class="pet-detail">
              <span class="detail-label">Weight:</span>
              <span class="detail-value">${weight}</span>
            </div>
            ` : ''}
            ${pet.gender ? `
            <div class="pet-detail">
              <span class="detail-label">Gender:</span>
              <span class="detail-value">${pet.gender.charAt(0).toUpperCase() + pet.gender.slice(1)}</span>
            </div>
            ` : ''}
          </div>
          
          ${pet.medicalConditions || pet.allergies || pet.medications ? `
          <div class="pet-health-alerts">
            ${pet.medicalConditions ? `<span class="health-alert condition">Medical Conditions</span>` : ''}
            ${pet.allergies ? `<span class="health-alert allergy">Allergies</span>` : ''}
            ${pet.medications ? `<span class="health-alert medication">On Medication</span>` : ''}
          </div>
          ` : ''}
        </div>

        <div class="pet-card-footer">
          <button class="btn btn-outline btn-small book-appointment-btn" data-pet-id="${pet.id}">
            <i class="fas fa-calendar-plus"></i>
            Book Appointment
          </button>
        </div>
      </div>
    `;
  }

  setupPetEventListeners() {
    // Pet menu toggles
    document.querySelectorAll('.pet-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const petId = btn.dataset.petId;
        this.togglePetMenu(petId);
      });
    });

    // Edit pet buttons
    document.querySelectorAll('.edit-pet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const petId = btn.dataset.petId;
        this.editPet(petId);
      });
    });

    // Delete pet buttons
    document.querySelectorAll('.delete-pet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const petId = btn.dataset.petId;
        this.deletePet(petId);
      });
    });

    // Book appointment buttons
    document.querySelectorAll('.book-appointment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const petId = btn.dataset.petId;
        this.bookAppointment(petId);
      });
    });

    // Close menus when clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.pet-menu-dropdown').forEach(menu => {
        menu.style.display = 'none';
      });
    });
  }

  togglePetMenu(petId) {
    const menu = document.getElementById(`pet-menu-${petId}`);
    const isVisible = menu.style.display === 'block';
    
    // Close all menus
    document.querySelectorAll('.pet-menu-dropdown').forEach(m => {
      m.style.display = 'none';
    });
    
    // Toggle current menu
    if (!isVisible) {
      menu.style.display = 'block';
    }
  }

  editPet(petId) {
    const pet = this.pets.find(p => p.id === petId);
    if (pet) {
      const modal = new PetRegistrationModal(pet);
      modal.show();
    }
  }

  async deletePet(petId) {
    const pet = this.pets.find(p => p.id === petId);
    if (!pet) return;

    if (confirm(`Are you sure you want to remove ${pet.name} from your pets?`)) {
      try {
        const result = await petService.deletePet(petId);
        
        if (result.success) {
          window.toastService.show(result.message, 'success');
          await this.loadPets(); // Refresh the list
        } else {
          window.toastService.show(result.error, 'error');
        }
      } catch (error) {
        console.error('Delete pet error:', error);
        window.toastService.show('Failed to remove pet', 'error');
      }
    }
  }

  bookAppointment(petId) {
    // Navigate to appointments page with pet pre-selected
    if (window.pawPalApp) {
      window.pawPalApp.navigateToPage('appointments');
      // TODO: Pre-select the pet in appointment booking
    }
  }

  showError(message) {
    const petsContent = document.querySelector('.pets-content');
    if (petsContent) {
      petsContent.innerHTML = `
        <div class="error-state">
          <div class="error-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3>Unable to Load Pets</h3>
          <p>${message}</p>
          <button class="btn btn-primary" onclick="window.pawPalApp.components.pages.pets.loadPets()">
            <i class="fas fa-refresh"></i>
            Try Again
          </button>
        </div>
      `;
    }
  }

  async refresh() {
    await this.loadPets();
  }
}

class AppointmentsComponent {
  init() {
    console.log('Appointments component initialized');
  }
}

class VetsComponent {
  init() {
    console.log('Vets component initialized');
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.pawPalApp = PawPalApp.getInstance();
});

// Handle page load for navigation
window.addEventListener('load', () => {
  // App initialization is handled in DOMContentLoaded
});

// Export for external use
window.PawPalApp = PawPalApp;