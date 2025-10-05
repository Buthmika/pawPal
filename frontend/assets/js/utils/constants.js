// Application constants and configuration
const APP_CONFIG = {
  APP_NAME: 'PawPal',
  VERSION: '1.0.0',
  ENVIRONMENT: 'development', // development, staging, production
  DEBUG: true,
  
  // API Configuration
  API_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  
  // File Upload Limits
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_IMAGES_PER_PET: 5,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Notifications
  TOAST_DURATION: 5000, // 5 seconds
  AUTO_HIDE_SUCCESS: true,
  AUTO_HIDE_INFO: true,
  AUTO_HIDE_WARNING: false,
  AUTO_HIDE_ERROR: false,
  
  // Appointment Configuration
  MIN_APPOINTMENT_DURATION: 30, // minutes
  MAX_APPOINTMENT_DURATION: 180, // minutes
  BOOKING_ADVANCE_DAYS: 90, // how many days in advance booking is allowed
  CANCELLATION_HOURS: 24, // minimum hours before appointment to cancel
  
  // Validation Rules
  VALIDATION: {
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REQUIRE_SPECIAL: true,
    PASSWORD_REQUIRE_NUMBERS: true,
    PASSWORD_REQUIRE_UPPERCASE: true,
    PHONE_REGEX: /^[\+]?[1-9][\d]{0,15}$/,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PET_NAME_MAX_LENGTH: 50,
    USER_NAME_MAX_LENGTH: 100,
    DESCRIPTION_MAX_LENGTH: 1000
  },
  
  // Date Formats
  DATE_FORMATS: {
    DISPLAY: 'MMM DD, YYYY',
    INPUT: 'YYYY-MM-DD',
    DATETIME: 'MMM DD, YYYY hh:mm A',
    TIME: 'hh:mm A'
  },
  
  // Pet Categories
  PET_TYPES: [
    { value: 'dog', label: 'Dog', icon: 'fas fa-dog' },
    { value: 'cat', label: 'Cat', icon: 'fas fa-cat' },
    { value: 'bird', label: 'Bird', icon: 'fas fa-dove' },
    { value: 'fish', label: 'Fish', icon: 'fas fa-fish' },
    { value: 'rabbit', label: 'Rabbit', icon: 'fas fa-rabbit' },
    { value: 'hamster', label: 'Hamster', icon: 'fas fa-hamster' },
    { value: 'guinea_pig', label: 'Guinea Pig', icon: 'fas fa-paw' },
    { value: 'reptile', label: 'Reptile', icon: 'fas fa-dragon' },
    { value: 'horse', label: 'Horse', icon: 'fas fa-horse' },
    { value: 'other', label: 'Other', icon: 'fas fa-paw' }
  ],
  
  // Veterinary Specializations
  VET_SPECIALIZATIONS: [
    'General Practice',
    'Surgery',
    'Internal Medicine',
    'Emergency & Critical Care',
    'Cardiology',
    'Dermatology',
    'Neurology',
    'Oncology',
    'Ophthalmology',
    'Orthopedics',
    'Dentistry',
    'Exotic Animals',
    'Behavior',
    'Reproduction',
    'Nutrition',
    'Preventive Care'
  ],
  
  // Common Vaccines
  COMMON_VACCINES: {
    dog: [
      'DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)',
      'Rabies',
      'Bordetella',
      'Lyme Disease',
      'Canine Influenza',
      'Leptospirosis'
    ],
    cat: [
      'FVRCP (Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia)',
      'Rabies',
      'FeLV (Feline Leukemia)',
      'FIV (Feline Immunodeficiency Virus)'
    ],
    other: [
      'Species-specific vaccines',
      'Core vaccines',
      'Non-core vaccines'
    ]
  },
  
  // Health Record Types
  HEALTH_RECORD_TYPES: [
    'Vaccination',
    'Surgery',
    'Illness',
    'Injury',
    'Medication',
    'Allergy',
    'Examination',
    'Laboratory Test',
    'Diagnostic Imaging',
    'Treatment',
    'Other'
  ],
  
  // Appointment Types
  APPOINTMENT_TYPES: [
    { value: 'checkup', label: 'Regular Check-up', duration: 30 },
    { value: 'vaccination', label: 'Vaccination', duration: 30 },
    { value: 'surgery', label: 'Surgery', duration: 120 },
    { value: 'emergency', label: 'Emergency', duration: 60 },
    { value: 'consultation', label: 'Consultation', duration: 45 },
    { value: 'grooming', label: 'Grooming', duration: 60 },
    { value: 'dental', label: 'Dental Care', duration: 90 },
    { value: 'follow_up', label: 'Follow-up', duration: 30 },
    { value: 'other', label: 'Other', duration: 45 }
  ],
  
  // Notification Types
  NOTIFICATION_TYPES: {
    APPOINTMENT_REMINDER: 'appointment_reminder',
    APPOINTMENT_CONFIRMED: 'appointment_confirmed',
    APPOINTMENT_CANCELLED: 'appointment_cancelled',
    VACCINATION_DUE: 'vaccination_due',
    HEALTH_RECORD_UPDATED: 'health_record_updated',
    VET_APPROVED: 'vet_approved',
    VET_REJECTED: 'vet_rejected',
    SYSTEM_ANNOUNCEMENT: 'system_announcement'
  },
  
  // Error Messages
  ERROR_MESSAGES: {
    NETWORK_ERROR: 'Network error. Please check your connection and try again.',
    AUTHENTICATION_FAILED: 'Authentication failed. Please login again.',
    PERMISSION_DENIED: 'You do not have permission to perform this action.',
    FILE_TOO_LARGE: 'File is too large. Maximum size is 5MB.',
    INVALID_FILE_TYPE: 'Invalid file type. Please upload an image.',
    FORM_VALIDATION_ERROR: 'Please check the form for errors.',
    APPOINTMENT_CONFLICT: 'This time slot is no longer available.',
    BOOKING_TOO_LATE: 'Appointments must be booked at least 2 hours in advance.',
    CANCELLATION_TOO_LATE: 'Appointments can only be cancelled 24 hours in advance.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.'
  },
  
  // Success Messages
  SUCCESS_MESSAGES: {
    PROFILE_UPDATED: 'Profile updated successfully!',
    PET_ADDED: 'Pet added successfully!',
    PET_UPDATED: 'Pet information updated successfully!',
    APPOINTMENT_BOOKED: 'Appointment booked successfully!',
    APPOINTMENT_CANCELLED: 'Appointment cancelled successfully!',
    HEALTH_RECORD_ADDED: 'Health record added successfully!',
    VACCINATION_RECORDED: 'Vaccination recorded successfully!',
    VET_APPLICATION_SUBMITTED: 'Veterinarian application submitted for review!',
    PASSWORD_UPDATED: 'Password updated successfully!',
    EMAIL_UPDATED: 'Email updated successfully!'
  },
  
  // Storage Paths
  STORAGE_PATHS: {
    PET_IMAGES: 'pets/{userId}/{petId}/',
    USER_AVATARS: 'users/{userId}/avatar/',
    VET_DOCUMENTS: 'vets/{vetId}/documents/',
    HEALTH_RECORDS: 'health-records/{petId}/'
  }
};

// Utility constants
const UTILS = {
  // Debounce delay for search inputs
  SEARCH_DEBOUNCE_DELAY: 300,
  
  // Animation durations
  ANIMATION_DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500
  },
  
  // Breakpoints for responsive design
  BREAKPOINTS: {
    XS: 480,
    SM: 768,
    MD: 1024,
    LG: 1280,
    XL: 1536
  },
  
  // Z-index scale
  Z_INDEX: {
    DROPDOWN: 1000,
    STICKY: 1010,
    FIXED: 1020,
    MODAL_BACKDROP: 1030,
    MODAL: 1040,
    POPOVER: 1050,
    TOOLTIP: 1060,
    TOAST: 1070
  }
};

// Export constants
window.APP_CONFIG = APP_CONFIG;
window.UTILS = UTILS;

// Development helpers
if (APP_CONFIG.DEBUG) {
  console.log('PawPal Application Loaded');
  console.log('Environment:', APP_CONFIG.ENVIRONMENT);
  console.log('Version:', APP_CONFIG.VERSION);
  
  // Make constants available in console for debugging
  window.debugConfig = {
    APP_CONFIG,
    UTILS,
    COLLECTIONS,
    USER_ROLES,
    APPOINTMENT_STATUS,
    VET_STATUS
  };
}