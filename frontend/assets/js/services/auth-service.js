// Authentication Service
class AuthService {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
    this.initialized = false;
    this.authStateListeners = [];
    
    this.init();
  }

  async init() {
    return new Promise((resolve) => {
      // Listen for auth state changes
      auth.onAuthStateChanged(async (user) => {
        if (user) {
          try {
            // Get user data from Firestore
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
            
            if (userDoc.exists) {
              this.currentUser = { 
                uid: user.uid, 
                email: user.email,
                emailVerified: user.emailVerified,
                ...userDoc.data() 
              };
              this.userRole = this.currentUser.role || USER_ROLES.PET_OWNER;
            } else {
              // Create user document if it doesn't exist
              await this.createUserDocument(user);
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
            this.currentUser = null;
            this.userRole = null;
          }
        } else {
          this.currentUser = null;
          this.userRole = null;
        }

        this.initialized = true;
        this.notifyAuthStateListeners();
        
        if (!resolve._called) {
          resolve._called = true;
          resolve();
        }
      });
    });
  }

  // Create user document in Firestore
  async createUserDocument(user, additionalData = {}) {
    const userData = {
      email: user.email,
      role: USER_ROLES.PET_OWNER,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      profile: {
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      preferences: {
        emailNotifications: true,
        smsNotifications: false,
        reminderFrequency: 'week_before'
      },
      ...additionalData
    };

    try {
      await db.collection(COLLECTIONS.USERS).doc(user.uid).set(userData);
      
      this.currentUser = { 
        uid: user.uid, 
        email: user.email,
        emailVerified: user.emailVerified,
        ...userData 
      };
      this.userRole = userData.role;
      
      return this.currentUser;
    } catch (error) {
      console.error('Error creating user document:', error);
      throw new Error('Failed to create user profile');
    }
  }

  // Register new user
  async register(email, password, additionalData = {}) {
    try {
      // Validate input
      if (!this.validateEmail(email)) {
        throw new Error('Please enter a valid email address');
      }
      
      if (!this.validatePassword(password)) {
        throw new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      }

      // Create user with Firebase Auth
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Send email verification
      await user.sendEmailVerification();

      // Create user document
      await this.createUserDocument(user, additionalData);

      return {
        success: true,
        user: this.currentUser,
        message: 'Account created successfully! Please check your email for verification.'
      };
    } catch (error) {
      console.error('Registration error:', error);
      
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') {
        message = 'An account with this email already exists';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address';
      }
      
      return {
        success: false,
        error: message
      };
    }
  }

  // Login user
  async login(email, password) {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      
      return {
        success: true,
        user: this.currentUser,
        message: 'Login successful!'
      };
    } catch (error) {
      console.error('Login error:', error);
      
      let message = error.message;
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed login attempts. Please try again later';
      }
      
      return {
        success: false,
        error: message
      };
    }
  }

  // Logout user
  async logout() {
    try {
      await auth.signOut();
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: 'Failed to logout'
      };
    }
  }

  // Reset password
  async resetPassword(email) {
    try {
      await auth.sendPasswordResetEmail(email);
      return {
        success: true,
        message: 'Password reset email sent. Please check your inbox.'
      };
    } catch (error) {
      console.error('Password reset error:', error);
      
      let message = error.message;
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address';
      }
      
      return {
        success: false,
        error: message
      };
    }
  }

  // Update user profile
  async updateProfile(profileData) {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      const updateData = {
        ...profileData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection(COLLECTIONS.USERS).doc(this.currentUser.uid).update(updateData);
      
      // Update local user data
      this.currentUser = { ...this.currentUser, ...updateData };
      this.notifyAuthStateListeners();
      
      return {
        success: true,
        message: 'Profile updated successfully'
      };
    } catch (error) {
      console.error('Profile update error:', error);
      return {
        success: false,
        error: 'Failed to update profile'
      };
    }
  }

  // Update user email
  async updateEmail(newEmail) {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      const user = auth.currentUser;
      await user.updateEmail(newEmail);
      
      // Update Firestore
      await db.collection(COLLECTIONS.USERS).doc(this.currentUser.uid).update({
        email: newEmail,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Send verification email for new email
      await user.sendEmailVerification();
      
      this.currentUser.email = newEmail;
      this.currentUser.emailVerified = false;
      this.notifyAuthStateListeners();
      
      return {
        success: true,
        message: 'Email updated successfully. Please verify your new email.'
      };
    } catch (error) {
      console.error('Email update error:', error);
      
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already in use';
      } else if (error.code === 'auth/requires-recent-login') {
        message = 'Please log in again to update your email';
      }
      
      return {
        success: false,
        error: message
      };
    }
  }

  // Update password
  async updatePassword(currentPassword, newPassword) {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      const user = auth.currentUser;
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      
      // Reauthenticate user
      await user.reauthenticateWithCredential(credential);
      
      // Validate new password
      if (!this.validatePassword(newPassword)) {
        throw new Error('New password must be at least 8 characters with uppercase, lowercase, number, and special character');
      }
      
      // Update password
      await user.updatePassword(newPassword);
      
      return {
        success: true,
        message: 'Password updated successfully'
      };
    } catch (error) {
      console.error('Password update error:', error);
      
      let message = error.message;
      if (error.code === 'auth/wrong-password') {
        message = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        message = 'New password is too weak';
      }
      
      return {
        success: false,
        error: message
      };
    }
  }

  // Resend email verification
  async resendEmailVerification() {
    try {
      const user = auth.currentUser;
      await user.sendEmailVerification();
      
      return {
        success: true,
        message: 'Verification email sent'
      };
    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        error: 'Failed to send verification email'
      };
    }
  }

  // Check if user has specific role
  hasRole(role) {
    return this.userRole === role;
  }

  // Check if user is admin
  isAdmin() {
    return this.hasRole(USER_ROLES.ADMIN);
  }

  // Check if user is veterinarian
  isVeterinarian() {
    return this.hasRole(USER_ROLES.VETERINARIAN);
  }

  // Check if user is pet owner
  isPetOwner() {
    return this.hasRole(USER_ROLES.PET_OWNER);
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Check if email is verified
  isEmailVerified() {
    return this.currentUser?.emailVerified || false;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Get user role
  getUserRole() {
    return this.userRole;
  }

  // Add auth state listener
  addAuthStateListener(callback) {
    this.authStateListeners.push(callback);
    
    // Call immediately if already initialized
    if (this.initialized) {
      callback(this.currentUser, this.userRole);
    }
  }

  // Remove auth state listener
  removeAuthStateListener(callback) {
    const index = this.authStateListeners.indexOf(callback);
    if (index > -1) {
      this.authStateListeners.splice(index, 1);
    }
  }

  // Notify all auth state listeners
  notifyAuthStateListeners() {
    this.authStateListeners.forEach(callback => {
      try {
        callback(this.currentUser, this.userRole);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }

  // Validate email format
  validateEmail(email) {
    return APP_CONFIG.VALIDATION.EMAIL_REGEX.test(email);
  }

  // Validate password strength
  validatePassword(password) {
    const config = APP_CONFIG.VALIDATION;
    
    if (password.length < config.PASSWORD_MIN_LENGTH) {
      return false;
    }
    
    if (config.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      return false;
    }
    
    if (config.PASSWORD_REQUIRE_NUMBERS && !/\d/.test(password)) {
      return false;
    }
    
    if (config.PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return false;
    }
    
    return true;
  }

  // Get Firebase Auth token for API requests
  async getAuthToken() {
    try {
      if (!auth.currentUser) {
        return null;
      }
      
      const token = await auth.currentUser.getIdToken();
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Get current authenticated user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser && !!auth.currentUser;
  }

  // Check if user is admin
  isAdmin() {
    return this.userRole === USER_ROLES.ADMIN;
  }

  // Check if user is veterinarian
  isVeterinarian() {
    return this.userRole === USER_ROLES.VETERINARIAN;
  }

  // Check if user is pet owner
  isPetOwner() {
    return this.userRole === USER_ROLES.PET_OWNER;
  }
}

// Create and export auth service instance
window.authService = new AuthService();