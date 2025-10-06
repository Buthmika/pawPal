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

// Middleware to verify admin role
async function verifyAdmin(req, res, next) {
  try {
    const { uid } = req.user;
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'admin') {
      return res.status(403).json({
        error: { message: 'Admin access required', code: 'NOT_ADMIN' }
      });
    }

    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    return res.status(500).json({
      error: { message: 'Failed to verify admin access', code: 'ADMIN_VERIFY_FAILED' }
    });
  }
}

// Get admin dashboard statistics
router.get('/dashboard/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Get counts for various entities
    const [
      usersSnapshot,
      petsSnapshot,
      appointmentsSnapshot,
      pendingVetsSnapshot,
      activeVetsSnapshot
    ] = await Promise.all([
      db.collection('users').where('isActive', '==', true).get(),
      db.collection('pets').where('isActive', '==', true).get(),
      db.collection('appointments').get(),
      db.collection('users')
        .where('role', '==', 'veterinarian')
        .where('vetApplicationStatus', '==', 'pending').get(),
      db.collection('users')
        .where('role', '==', 'veterinarian')
        .where('vetApplicationStatus', '==', 'approved')
        .where('isActive', '==', true).get()
    ]);

    // Count users by role
    const userStats = {
      total: 0,
      petOwners: 0,
      veterinarians: 0,
      admins: 0
    };

    usersSnapshot.forEach(doc => {
      const user = doc.data();
      userStats.total++;
      switch (user.role) {
        case 'pet_owner':
          userStats.petOwners++;
          break;
        case 'veterinarian':
          userStats.veterinarians++;
          break;
        case 'admin':
          userStats.admins++;
          break;
      }
    });

    // Count appointments by status
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

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsersSnapshot = await db.collection('users')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
      .get();

    const recentAppointmentsSnapshot = await db.collection('appointments')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
      .get();

    res.status(200).json({
      success: true,
      stats: {
        users: userStats,
        pets: {
          total: petsSnapshot.size
        },
        appointments: appointmentStats,
        veterinarians: {
          pending: pendingVetsSnapshot.size,
          active: activeVetsSnapshot.size
        },
        recentActivity: {
          newUsers: recentUsersSnapshot.size,
          newAppointments: recentAppointmentsSnapshot.size
        }
      }
    });

  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({
      error: { message: 'Failed to get admin statistics', code: 'GET_ADMIN_STATS_FAILED' }
    });
  }
});

// Get pending veterinarian applications
router.get('/veterinarians/applications', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const snapshot = await db.collection('users')
      .where('role', '==', 'veterinarian')
      .where('vetApplicationStatus', '==', 'pending')
      .orderBy('vetApplicationDate', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    const applications = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      applications.push({
        id: doc.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        licenseNumber: userData.licenseNumber,
        specialization: userData.specialization,
        yearsOfExperience: userData.yearsOfExperience,
        education: userData.education,
        clinicName: userData.clinicName,
        clinicAddress: userData.clinicAddress,
        about: userData.about,
        applicationDate: userData.vetApplicationDate?.toDate(),
        createdAt: userData.createdAt?.toDate()
      });
    });

    res.status(200).json({
      success: true,
      applications,
      hasMore: snapshot.size === parseInt(limit)
    });

  } catch (error) {
    console.error('Get vet applications error:', error);
    res.status(500).json({
      error: { message: 'Failed to get veterinarian applications', code: 'GET_VET_APPLICATIONS_FAILED' }
    });
  }
});

// Approve/reject veterinarian application
router.patch('/veterinarians/:vetId/application', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { vetId } = req.params;
    const { status, reason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: { message: 'Invalid status. Must be "approved" or "rejected"', code: 'INVALID_STATUS' }
      });
    }

    const vetRef = db.collection('users').doc(vetId);
    const vetDoc = await vetRef.get();

    if (!vetDoc.exists) {
      return res.status(404).json({
        error: { message: 'Veterinarian not found', code: 'VET_NOT_FOUND' }
      });
    }

    const vetData = vetDoc.data();
    if (vetData.role !== 'veterinarian' || vetData.vetApplicationStatus !== 'pending') {
      return res.status(400).json({
        error: { message: 'Invalid veterinarian application', code: 'INVALID_APPLICATION' }
      });
    }

    const updateData = {
      vetApplicationStatus: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (status === 'approved') {
      updateData.vetApprovedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.vetApprovedBy = req.user.uid;
    } else {
      updateData.vetRejectedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.vetRejectedBy = req.user.uid;
      if (reason) {
        updateData.vetRejectionReason = reason.trim();
      }
    }

    await vetRef.update(updateData);

    // Send notification email (import here to avoid circular dependency)
    const { sendVetApplicationStatusEmail } = require('../notifications/notificationService');
    await sendVetApplicationStatusEmail(vetId, status, reason);

    res.status(200).json({
      success: true,
      message: `Veterinarian application ${status} successfully`
    });

  } catch (error) {
    console.error('Update vet application error:', error);
    res.status(500).json({
      error: { message: 'Failed to update veterinarian application', code: 'UPDATE_VET_APPLICATION_FAILED' }
    });
  }
});

// Get all users (with pagination and filtering)
router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { role, status, limit = 20, offset = 0, search } = req.query;

    let query = db.collection('users');

    if (role && role !== 'all') {
      query = query.where('role', '==', role);
    }

    if (status === 'active') {
      query = query.where('isActive', '==', true);
    } else if (status === 'inactive') {
      query = query.where('isActive', '==', false);
    }

    // For search, we'll need to get all matching documents and filter client-side
    // In a production app, you'd want to use a search service like Algolia
    let snapshot;
    if (search) {
      snapshot = await query.get();
      // Filter by search term in client (not ideal for large datasets)
      const searchLower = search.toLowerCase();
      const filteredDocs = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const fullName = `${data.firstName || ''} ${data.lastName || ''}`.toLowerCase();
        const email = (data.email || '').toLowerCase();
        if (fullName.includes(searchLower) || email.includes(searchLower)) {
          filteredDocs.push({ id: doc.id, data: data });
        }
      });
      
      // Apply pagination to filtered results
      const paginatedDocs = filteredDocs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
      
      const users = paginatedDocs.map(doc => ({
        id: doc.id,
        ...doc.data,
        createdAt: doc.data.createdAt?.toDate(),
        updatedAt: doc.data.updatedAt?.toDate(),
        lastLoginAt: doc.data.lastLoginAt?.toDate()
      }));

      return res.status(200).json({
        success: true,
        users,
        hasMore: filteredDocs.length > parseInt(offset) + parseInt(limit),
        total: filteredDocs.length
      });
    } else {
      snapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset))
        .get();
    }

    const users = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        ...userData,
        createdAt: userData.createdAt?.toDate(),
        updatedAt: userData.updatedAt?.toDate(),
        lastLoginAt: userData.lastLoginAt?.toDate()
      });
    });

    res.status(200).json({
      success: true,
      users,
      hasMore: snapshot.size === parseInt(limit)
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: { message: 'Failed to get users', code: 'GET_USERS_FAILED' }
    });
  }
});

// Deactivate/reactivate user
router.patch('/users/:userId/status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive, reason } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        error: { message: 'isActive must be a boolean', code: 'INVALID_STATUS' }
      });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: { message: 'User not found', code: 'USER_NOT_FOUND' }
      });
    }

    // Don't allow deactivating other admins
    const userData = userDoc.data();
    if (userData.role === 'admin' && !isActive) {
      return res.status(403).json({
        error: { message: 'Cannot deactivate admin users', code: 'CANNOT_DEACTIVATE_ADMIN' }
      });
    }

    const updateData = {
      isActive,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (!isActive) {
      updateData.deactivatedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.deactivatedBy = req.user.uid;
      if (reason) {
        updateData.deactivationReason = reason.trim();
      }
    } else {
      updateData.reactivatedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.reactivatedBy = req.user.uid;
    }

    await userRef.update(updateData);

    // If deactivating, also cancel any pending appointments
    if (!isActive) {
      const batch = db.batch();
      
      // Cancel user's appointments as owner
      const ownerAppointments = await db.collection('appointments')
        .where('ownerId', '==', userId)
        .where('status', 'in', ['pending', 'confirmed'])
        .get();

      ownerAppointments.forEach(doc => {
        batch.update(doc.ref, {
          status: 'cancelled',
          statusReason: 'User account deactivated',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      // Cancel vet's appointments if they are a veterinarian
      if (userData.role === 'veterinarian') {
        const vetAppointments = await db.collection('appointments')
          .where('veterinarianId', '==', userId)
          .where('status', 'in', ['pending', 'confirmed'])
          .get();

        vetAppointments.forEach(doc => {
          batch.update(doc.ref, {
            status: 'cancelled',
            statusReason: 'Veterinarian account deactivated',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });
      }

      await batch.commit();
    }

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'reactivated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      error: { message: 'Failed to update user status', code: 'UPDATE_USER_STATUS_FAILED' }
    });
  }
});

// Get system activities/logs
router.get('/activities', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0, type, startDate, endDate } = req.query;

    // This would typically be from a separate activities/logs collection
    // For now, we'll return recent notifications as a proxy for activities
    let query = db.collection('notifications')
      .orderBy('createdAt', 'desc');

    if (type && type !== 'all') {
      query = query.where('type', '==', type);
    }

    if (startDate && endDate) {
      query = query
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(startDate)))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(new Date(endDate)));
    }

    const snapshot = await query
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    const activities = [];
    snapshot.forEach(doc => {
      const activityData = doc.data();
      activities.push({
        id: doc.id,
        ...activityData,
        createdAt: activityData.createdAt?.toDate()
      });
    });

    res.status(200).json({
      success: true,
      activities,
      hasMore: snapshot.size === parseInt(limit)
    });

  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({
      error: { message: 'Failed to get system activities', code: 'GET_ACTIVITIES_FAILED' }
    });
  }
});

// Get system configuration
router.get('/config', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // This would typically come from a config collection
    const config = {
      appointmentSettings: {
        maxAdvanceBookingDays: 90,
        defaultAppointmentDuration: 30,
        allowSameDayBooking: true,
        workingHours: {
          start: '09:00',
          end: '17:00'
        }
      },
      notificationSettings: {
        emailEnabled: true,
        smsEnabled: false,
        reminderHours: 24
      },
      systemSettings: {
        maintenanceMode: false,
        allowNewRegistrations: true,
        requireEmailVerification: true
      }
    };

    res.status(200).json({
      success: true,
      config
    });

  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({
      error: { message: 'Failed to get system configuration', code: 'GET_CONFIG_FAILED' }
    });
  }
});

module.exports = router;