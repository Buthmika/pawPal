// Firebase Configuration for Local Development
// Using Firebase Emulators for local development
const firebaseConfig = {
  apiKey: "AIzaSyBHqLT5aB9ah0M-Jm-9uzkoYKAiLZEKCck",
  authDomain: "pawpal-567da.firebaseapp.com",
  projectId: "pawpal-567da",
  storageBucket: "pawpal-567da.firebasestorage.app",
  messagingSenderId: "298627375101",
  appId: "1:298627375101:web:72783d40488e54ad8cc394",
  measurementId: "G-6G8G7LDXLN"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();

// Using real Firebase project - no emulators needed
console.log('Connected to Firebase project:', firebaseConfig.projectId);

// API Configuration
const API_BASE_URL = 'https://us-central1-pawpal-567da.cloudfunctions.net/api';

// Firestore collections
const COLLECTIONS = {
  USERS: 'users',
  PETS: 'pets',
  VETS: 'veterinarians',
  APPOINTMENTS: 'appointments',
  HEALTH_RECORDS: 'healthRecords',
  VACCINATIONS: 'vaccinations',
  NOTIFICATIONS: 'notifications',
  ADMIN_REQUESTS: 'adminRequests'
};

// User roles
const USER_ROLES = {
  PET_OWNER: 'pet_owner',
  VETERINARIAN: 'veterinarian',
  ADMIN: 'admin'
};

// Appointment statuses
const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
};

// Vet verification statuses
const VET_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended'
};

// Export for use in other files
window.firebaseConfig = firebaseConfig;
window.auth = auth;
window.db = db;
window.storage = storage;
window.functions = functions;
window.COLLECTIONS = COLLECTIONS;
window.USER_ROLES = USER_ROLES;
window.APPOINTMENT_STATUS = APPOINTMENT_STATUS;
window.VET_STATUS = VET_STATUS;
window.API_BASE_URL = API_BASE_URL;