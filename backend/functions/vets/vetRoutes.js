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

// Apply to become a veterinarian
router.post('/apply', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const {
      firstName,
      lastName,
      phone,
      address,
      licenseNumber,
      specialization,
      yearsOfExperience,
      education,
      clinicName,
      clinicAddress,
      about
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !phone || !licenseNumber || !specialization || !yearsOfExperience) {
      return res.status(400).json({
        error: { message: 'Missing required fields', code: 'MISSING_FIELDS' }
      });
    }

    // Check if user already applied
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (userData?.vetApplicationStatus === 'pending') {
      return res.status(400).json({
        error: { message: 'Application already pending', code: 'APPLICATION_PENDING' }
      });
    }

    if (userData?.vetApplicationStatus === 'approved' && userData?.role === 'veterinarian') {
      return res.status(400).json({
        error: { message: 'Already approved as veterinarian', code: 'ALREADY_VETERINARIAN' }
      });
    }

    const applicationData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      address: address ? address.trim() : null,
      licenseNumber: licenseNumber.trim(),
      specialization: specialization.trim(),
      yearsOfExperience: parseInt(yearsOfExperience),
      education: education ? education.trim() : null,
      clinicName: clinicName ? clinicName.trim() : null,
      clinicAddress: clinicAddress ? clinicAddress.trim() : null,
      about: about ? about.trim() : null,
      role: 'veterinarian',
      vetApplicationStatus: 'pending',
      vetApplicationDate: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid).update(applicationData);

    // Create notification for admins
    const adminsSnapshot = await db.collection('users')
      .where('role', '==', 'admin')
      .get();

    const adminNotifications = [];
    adminsSnapshot.forEach(doc => {
      adminNotifications.push(
        db.collection('notifications').add({
          userId: doc.id,
          type: 'new_vet_application',
          title: 'New Veterinarian Application',
          message: `${firstName} ${lastName} has applied to become a veterinarian`,
          data: {
            applicantId: uid,
            applicantName: `${firstName} ${lastName}`,
            specialization
          },
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        })
      );
    });

    await Promise.all(adminNotifications);

    res.status(200).json({
      success: true,
      message: 'Veterinarian application submitted successfully'
    });

  } catch (error) {
    console.error('Vet application error:', error);
    res.status(500).json({
      error: { message: 'Failed to submit application', code: 'APPLICATION_FAILED' }
    });
  }
});

// Get list of veterinarians (public)
router.get('/', async (req, res) => {
  try {
    const { specialization, limit = 20, offset = 0 } = req.query;

    let query = db.collection('users')
      .where('role', '==', 'veterinarian')
      .where('vetApplicationStatus', '==', 'approved')
      .where('isActive', '==', true);

    if (specialization) {
      query = query.where('specialization', '==', specialization);
    }

    const snapshot = await query
      .orderBy('firstName')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    const veterinarians = [];
    snapshot.forEach(doc => {
      const vetData = doc.data();
      veterinarians.push({
        id: doc.id,
        firstName: vetData.firstName,
        lastName: vetData.lastName,
        specialization: vetData.specialization,
        yearsOfExperience: vetData.yearsOfExperience,
        clinicName: vetData.clinicName,
        clinicAddress: vetData.clinicAddress,
        about: vetData.about,
        profilePhoto: vetData.profilePhoto
      });
    });

    res.status(200).json({
      success: true,
      veterinarians,
      hasMore: snapshot.size === parseInt(limit)
    });

  } catch (error) {
    console.error('Get veterinarians error:', error);
    res.status(500).json({
      error: { message: 'Failed to get veterinarians', code: 'GET_VETS_FAILED' }
    });
  }
});

// Get veterinarian profile
router.get('/:vetId', async (req, res) => {
  try {
    const { vetId } = req.params;

    const vetDoc = await db.collection('users').doc(vetId).get();

    if (!vetDoc.exists) {
      return res.status(404).json({
        error: { message: 'Veterinarian not found', code: 'VET_NOT_FOUND' }
      });
    }

    const vetData = vetDoc.data();

    if (vetData.role !== 'veterinarian' || vetData.vetApplicationStatus !== 'approved') {
      return res.status(404).json({
        error: { message: 'Veterinarian not found', code: 'VET_NOT_FOUND' }
      });
    }

    // Get average rating and review count
    const reviewsSnapshot = await db.collection('reviews')
      .where('veterinarianId', '==', vetId)
      .get();

    let totalRating = 0;
    let reviewCount = 0;
    const recentReviews = [];

    reviewsSnapshot.forEach(doc => {
      const review = doc.data();
      totalRating += review.rating;
      reviewCount++;

      if (recentReviews.length < 5) {
        recentReviews.push({
          id: doc.id,
          rating: review.rating,
          comment: review.comment,
          reviewerName: review.reviewerName,
          createdAt: review.createdAt?.toDate()
        });
      }
    });

    const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;

    res.status(200).json({
      success: true,
      veterinarian: {
        id: vetId,
        firstName: vetData.firstName,
        lastName: vetData.lastName,
        email: vetData.email,
        phone: vetData.phone,
        specialization: vetData.specialization,
        yearsOfExperience: vetData.yearsOfExperience,
        education: vetData.education,
        clinicName: vetData.clinicName,
        clinicAddress: vetData.clinicAddress,
        about: vetData.about,
        profilePhoto: vetData.profilePhoto,
        averageRating: Math.round(averageRating * 10) / 10,
        reviewCount,
        recentReviews
      }
    });

  } catch (error) {
    console.error('Get veterinarian error:', error);
    res.status(500).json({
      error: { message: 'Failed to get veterinarian', code: 'GET_VET_FAILED' }
    });
  }
});

// Update veterinarian profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const {
      phone,
      address,
      specialization,
      yearsOfExperience,
      education,
      clinicName,
      clinicAddress,
      about
    } = req.body;

    // Verify user is an approved veterinarian
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    if (userData?.role !== 'veterinarian' || userData?.vetApplicationStatus !== 'approved') {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'NOT_VETERINARIAN' }
      });
    }

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (phone) updateData.phone = phone.trim();
    if (address !== undefined) updateData.address = address ? address.trim() : null;
    if (specialization) updateData.specialization = specialization.trim();
    if (yearsOfExperience !== undefined) updateData.yearsOfExperience = parseInt(yearsOfExperience);
    if (education !== undefined) updateData.education = education ? education.trim() : null;
    if (clinicName !== undefined) updateData.clinicName = clinicName ? clinicName.trim() : null;
    if (clinicAddress !== undefined) updateData.clinicAddress = clinicAddress ? clinicAddress.trim() : null;
    if (about !== undefined) updateData.about = about ? about.trim() : null;

    await db.collection('users').doc(uid).update(updateData);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update vet profile error:', error);
    res.status(500).json({
      error: { message: 'Failed to update profile', code: 'UPDATE_PROFILE_FAILED' }
    });
  }
});

// Get veterinarian's appointments
router.get('/appointments/mine', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { status, date, limit = 20, offset = 0 } = req.query;

    // Verify user is veterinarian
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.data()?.role !== 'veterinarian') {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'NOT_VETERINARIAN' }
      });
    }

    let query = db.collection('appointments').where('veterinarianId', '==', uid);

    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    if (date) {
      const requestedDate = new Date(date);
      const dayStart = new Date(requestedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(requestedDate);
      dayEnd.setHours(23, 59, 59, 999);

      query = query
        .where('dateTime', '>=', admin.firestore.Timestamp.fromDate(dayStart))
        .where('dateTime', '<=', admin.firestore.Timestamp.fromDate(dayEnd));
    }

    query = query.orderBy('dateTime', 'asc');

    const snapshot = await query
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    const appointments = [];
    const petIds = new Set();
    const ownerIds = new Set();

    snapshot.forEach(doc => {
      const appointmentData = doc.data();
      appointments.push({
        id: doc.id,
        ...appointmentData
      });
      petIds.add(appointmentData.petId);
      ownerIds.add(appointmentData.ownerId);
    });

    // Fetch related data
    const [pets, owners] = await Promise.all([
      Promise.all(Array.from(petIds).map(id => db.collection('pets').doc(id).get())),
      Promise.all(Array.from(ownerIds).map(id => db.collection('users').doc(id).get()))
    ]);

    const petMap = new Map();
    const ownerMap = new Map();

    pets.forEach(doc => {
      if (doc.exists) {
        petMap.set(doc.id, doc.data());
      }
    });

    owners.forEach(doc => {
      if (doc.exists) {
        const ownerData = doc.data();
        ownerMap.set(doc.id, {
          id: doc.id,
          firstName: ownerData.firstName,
          lastName: ownerData.lastName,
          phone: ownerData.phone,
          email: ownerData.email
        });
      }
    });

    const enrichedAppointments = appointments.map(appointment => ({
      ...appointment,
      dateTime: appointment.dateTime?.toDate(),
      createdAt: appointment.createdAt?.toDate(),
      updatedAt: appointment.updatedAt?.toDate(),
      pet: petMap.get(appointment.petId),
      owner: ownerMap.get(appointment.ownerId)
    }));

    res.status(200).json({
      success: true,
      appointments: enrichedAppointments,
      hasMore: snapshot.size === parseInt(limit)
    });

  } catch (error) {
    console.error('Get vet appointments error:', error);
    res.status(500).json({
      error: { message: 'Failed to get appointments', code: 'GET_APPOINTMENTS_FAILED' }
    });
  }
});

// Get veterinarian statistics
router.get('/stats/dashboard', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    // Verify user is veterinarian
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.data()?.role !== 'veterinarian') {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'NOT_VETERINARIAN' }
      });
    }

    // Get appointment statistics
    const appointmentsSnapshot = await db.collection('appointments')
      .where('veterinarianId', '==', uid)
      .get();

    const stats = {
      totalAppointments: 0,
      todayAppointments: 0,
      upcomingAppointments: 0,
      pendingAppointments: 0,
      completedAppointments: 0
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    appointmentsSnapshot.forEach(doc => {
      const appointment = doc.data();
      const appointmentDate = appointment.dateTime.toDate();

      stats.totalAppointments++;

      if (appointmentDate >= today && appointmentDate < tomorrow) {
        stats.todayAppointments++;
      }

      if (appointmentDate >= new Date() && appointment.status === 'confirmed') {
        stats.upcomingAppointments++;
      }

      if (appointment.status === 'pending') {
        stats.pendingAppointments++;
      }

      if (appointment.status === 'completed') {
        stats.completedAppointments++;
      }
    });

    // Get review statistics
    const reviewsSnapshot = await db.collection('reviews')
      .where('veterinarianId', '==', uid)
      .get();

    let totalRating = 0;
    reviewsSnapshot.forEach(doc => {
      totalRating += doc.data().rating;
    });

    const averageRating = reviewsSnapshot.size > 0 ? totalRating / reviewsSnapshot.size : 0;

    stats.reviewCount = reviewsSnapshot.size;
    stats.averageRating = Math.round(averageRating * 10) / 10;

    res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get vet stats error:', error);
    res.status(500).json({
      error: { message: 'Failed to get statistics', code: 'GET_STATS_FAILED' }
    });
  }
});

// Get veterinarian specializations (for dropdown)
router.get('/meta/specializations', async (req, res) => {
  try {
    const specializations = [
      'General Practice',
      'Surgery',
      'Internal Medicine',
      'Cardiology',
      'Dermatology',
      'Neurology',
      'Oncology',
      'Ophthalmology',
      'Orthopedics',
      'Emergency Medicine',
      'Exotic Animals',
      'Dental Care',
      'Behavioral Medicine',
      'Reproduction',
      'Pathology'
    ];

    res.status(200).json({
      success: true,
      specializations
    });

  } catch (error) {
    console.error('Get specializations error:', error);
    res.status(500).json({
      error: { message: 'Failed to get specializations', code: 'GET_SPECIALIZATIONS_FAILED' }
    });
  }
});

module.exports = router;