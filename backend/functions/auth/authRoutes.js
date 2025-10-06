const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Get Firebase services
const db = admin.firestore();
const auth = admin.auth();

// Middleware to verify Firebase ID token
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { message: 'Unauthorized', code: 'NO_TOKEN' }
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({
      error: { message: 'Invalid token', code: 'INVALID_TOKEN' }
    });
  }
}

// Update user profile after authentication
router.post('/update-profile', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { firstName, lastName, phone, address, role } = req.body;

    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({
        error: { message: 'First name and last name are required', code: 'MISSING_FIELDS' }
      });
    }

    // Validate role
    const validRoles = ['pet_owner', 'veterinarian', 'admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        error: { message: 'Invalid role', code: 'INVALID_ROLE' }
      });
    }

    // Update user document
    const userRef = db.collection('users').doc(uid);
    const updateData = {
      firstName,
      lastName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    
    // Only allow role change for specific cases
    if (role === 'veterinarian') {
      updateData.role = role;
      updateData.vetApplicationStatus = 'pending';
      updateData.vetApplicationDate = admin.firestore.FieldValue.serverTimestamp();
    }

    await userRef.update(updateData);

    // Get updated user data
    const updatedUser = await userRef.get();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: { uid, ...updatedUser.data() }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: { message: 'Failed to update profile', code: 'UPDATE_FAILED' }
    });
  }
});

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        error: { message: 'User not found', code: 'USER_NOT_FOUND' }
      });
    }

    const userData = userDoc.data();
    
    // Remove sensitive fields
    delete userData.password;

    res.status(200).json({
      user: { uid, ...userData }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: { message: 'Failed to get profile', code: 'GET_PROFILE_FAILED' }
    });
  }
});

// Change password
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { currentPassword, newPassword } = req.body;

    // Validate password requirements
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        error: { 
          message: 'Password must be at least 8 characters long', 
          code: 'WEAK_PASSWORD' 
        }
      });
    }

    // Update password in Firebase Auth
    await auth.updateUser(uid, {
      password: newPassword
    });

    // Update user document
    await db.collection('users').doc(uid).update({
      passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: { message: 'Failed to change password', code: 'PASSWORD_CHANGE_FAILED' }
    });
  }
});

// Verify email
router.post('/verify-email', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    // Generate email verification link
    const actionCodeSettings = {
      url: `${process.env.FRONTEND_URL}/email-verified`,
      handleCodeInApp: false
    };

    const link = await auth.generateEmailVerificationLink(req.user.email, actionCodeSettings);

    // Update user document
    await db.collection('users').doc(uid).update({
      emailVerificationSent: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: 'Email verification sent',
      verificationLink: link
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: { message: 'Failed to send email verification', code: 'EMAIL_VERIFICATION_FAILED' }
    });
  }
});

// Delete account
router.delete('/account', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { confirmation } = req.body;

    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        error: { 
          message: 'Account deletion requires confirmation', 
          code: 'MISSING_CONFIRMATION' 
        }
      });
    }

    // Check if user has active appointments
    const activeAppointments = await db.collection('appointments')
      .where('ownerId', '==', uid)
      .where('status', 'in', ['confirmed', 'pending'])
      .get();

    if (!activeAppointments.empty) {
      return res.status(400).json({
        error: { 
          message: 'Cannot delete account with active appointments', 
          code: 'ACTIVE_APPOINTMENTS_EXIST' 
        }
      });
    }

    // Mark user as inactive instead of deleting immediately
    await db.collection('users').doc(uid).update({
      isActive: false,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletionScheduled: admin.firestore.FieldValue.serverTimestamp()
    });

    // Schedule actual deletion after 30 days
    // This will be handled by a separate scheduled function

    res.status(200).json({
      message: 'Account deletion scheduled. You have 30 days to recover your account.'
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      error: { message: 'Failed to delete account', code: 'DELETE_ACCOUNT_FAILED' }
    });
  }
});

// Recover deleted account
router.post('/recover', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (!userData || userData.isActive) {
      return res.status(400).json({
        error: { message: 'Account is already active', code: 'ACCOUNT_ACTIVE' }
      });
    }

    // Check if within recovery period (30 days)
    const deletionDate = userData.deletionScheduled?.toDate();
    if (deletionDate) {
      const recoveryDeadline = new Date(deletionDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (new Date() > recoveryDeadline) {
        return res.status(400).json({
          error: { message: 'Recovery period has expired', code: 'RECOVERY_EXPIRED' }
        });
      }
    }

    // Reactivate account
    await db.collection('users').doc(uid).update({
      isActive: true,
      recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedAt: admin.firestore.FieldValue.delete(),
      deletionScheduled: admin.firestore.FieldValue.delete()
    });

    res.status(200).json({
      message: 'Account recovered successfully'
    });

  } catch (error) {
    console.error('Account recovery error:', error);
    res.status(500).json({
      error: { message: 'Failed to recover account', code: 'RECOVERY_FAILED' }
    });
  }
});

module.exports = router;