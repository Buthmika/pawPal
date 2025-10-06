const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Get Firestore instance
const db = admin.firestore();

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
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({
      error: { message: 'Invalid token', code: 'INVALID_TOKEN' }
    });
  }
}

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
    
    res.status(200).json({
      success: true,
      user: { 
        uid, 
        ...userData,
        createdAt: userData.createdAt?.toDate(),
        updatedAt: userData.updatedAt?.toDate(),
        lastLoginAt: userData.lastLoginAt?.toDate()
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: { message: 'Failed to get profile', code: 'GET_PROFILE_FAILED' }
    });
  }
});

// Update user profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { 
      firstName, 
      lastName, 
      phone, 
      address, 
      emergencyContact,
      preferences 
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({
        error: { message: 'First name and last name are required', code: 'MISSING_FIELDS' }
      });
    }

    // Validate phone number format
    if (phone && !/^\+?[\d\s\-\(\)]+$/.test(phone)) {
      return res.status(400).json({
        error: { message: 'Invalid phone number format', code: 'INVALID_PHONE' }
      });
    }

    const updateData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (phone) updateData.phone = phone.trim();
    if (address) updateData.address = address;
    if (emergencyContact) updateData.emergencyContact = emergencyContact;
    if (preferences) updateData.preferences = preferences;

    await db.collection('users').doc(uid).update(updateData);

    // Get updated user data
    const updatedUser = await db.collection('users').doc(uid).get();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: { 
        uid, 
        ...updatedUser.data(),
        updatedAt: updatedUser.data().updatedAt?.toDate()
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: { message: 'Failed to update profile', code: 'UPDATE_FAILED' }
    });
  }
});

// Get user's pets
router.get('/pets', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    const petsSnapshot = await db.collection('pets')
      .where('ownerId', '==', uid)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    const pets = [];
    petsSnapshot.forEach(doc => {
      const petData = doc.data();
      pets.push({
        id: doc.id,
        ...petData,
        dateOfBirth: petData.dateOfBirth?.toDate(),
        createdAt: petData.createdAt?.toDate(),
        updatedAt: petData.updatedAt?.toDate(),
        nextVaccinationDate: petData.nextVaccinationDate?.toDate()
      });
    });

    res.status(200).json({
      success: true,
      pets
    });

  } catch (error) {
    console.error('Get user pets error:', error);
    res.status(500).json({
      error: { message: 'Failed to get pets', code: 'GET_PETS_FAILED' }
    });
  }
});

// Get user's appointments
router.get('/appointments', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { status, limit = 20, offset = 0 } = req.query;

    let query = db.collection('appointments')
      .where('ownerId', '==', uid)
      .orderBy('dateTime', 'desc');

    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    const appointments = [];
    snapshot.forEach(doc => {
      const appointmentData = doc.data();
      appointments.push({
        id: doc.id,
        ...appointmentData,
        dateTime: appointmentData.dateTime?.toDate(),
        createdAt: appointmentData.createdAt?.toDate(),
        updatedAt: appointmentData.updatedAt?.toDate()
      });
    });

    res.status(200).json({
      success: true,
      appointments,
      hasMore: snapshot.size === parseInt(limit)
    });

  } catch (error) {
    console.error('Get user appointments error:', error);
    res.status(500).json({
      error: { message: 'Failed to get appointments', code: 'GET_APPOINTMENTS_FAILED' }
    });
  }
});

// Get user's notifications
router.get('/notifications', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;

    let query = db.collection('notifications')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc');

    if (unreadOnly === 'true') {
      query = query.where('read', '==', false);
    }

    const snapshot = await query
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    const notifications = [];
    snapshot.forEach(doc => {
      const notificationData = doc.data();
      notifications.push({
        id: doc.id,
        ...notificationData,
        createdAt: notificationData.createdAt?.toDate(),
        readAt: notificationData.readAt?.toDate()
      });
    });

    res.status(200).json({
      success: true,
      notifications,
      hasMore: snapshot.size === parseInt(limit)
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      error: { message: 'Failed to get notifications', code: 'GET_NOTIFICATIONS_FAILED' }
    });
  }
});

// Mark notification as read
router.patch('/notifications/:notificationId/read', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { notificationId } = req.params;

    const notificationRef = db.collection('notifications').doc(notificationId);
    const notificationDoc = await notificationRef.get();

    if (!notificationDoc.exists) {
      return res.status(404).json({
        error: { message: 'Notification not found', code: 'NOTIFICATION_NOT_FOUND' }
      });
    }

    const notificationData = notificationDoc.data();
    if (notificationData.userId !== uid) {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }

    await notificationRef.update({
      read: true,
      readAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      error: { message: 'Failed to mark notification as read', code: 'MARK_READ_FAILED' }
    });
  }
});

// Mark all notifications as read
router.patch('/notifications/read-all', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    const batch = db.batch();
    const snapshot = await db.collection('notifications')
      .where('userId', '==', uid)
      .where('read', '==', false)
      .get();

    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        read: true,
        readAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      count: snapshot.size
    });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      error: { message: 'Failed to mark all notifications as read', code: 'MARK_ALL_READ_FAILED' }
    });
  }
});

// Update user preferences
router.patch('/preferences', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        error: { message: 'Invalid preferences object', code: 'INVALID_PREFERENCES' }
      });
    }

    await db.collection('users').doc(uid).update({
      preferences,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      message: 'Preferences updated successfully'
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      error: { message: 'Failed to update preferences', code: 'UPDATE_PREFERENCES_FAILED' }
    });
  }
});

// Get user statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    // Get pets count
    const petsSnapshot = await db.collection('pets')
      .where('ownerId', '==', uid)
      .where('isActive', '==', true)
      .get();

    // Get appointments count by status
    const appointmentsSnapshot = await db.collection('appointments')
      .where('ownerId', '==', uid)
      .get();

    const appointmentStats = {
      total: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0
    };

    appointmentsSnapshot.forEach(doc => {
      const appointment = doc.data();
      appointmentStats.total++;
      appointmentStats[appointment.status] = (appointmentStats[appointment.status] || 0) + 1;
    });

    // Get unread notifications count
    const unreadNotificationsSnapshot = await db.collection('notifications')
      .where('userId', '==', uid)
      .where('read', '==', false)
      .get();

    res.status(200).json({
      success: true,
      stats: {
        pets: petsSnapshot.size,
        appointments: appointmentStats,
        unreadNotifications: unreadNotificationsSnapshot.size
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: { message: 'Failed to get user statistics', code: 'GET_STATS_FAILED' }
    });
  }
});

module.exports = router;