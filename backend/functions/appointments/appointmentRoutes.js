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

// Create a new appointment
router.post('/', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const {
      petId,
      veterinarianId,
      dateTime,
      type,
      reason,
      notes,
      duration = 30
    } = req.body;

    // Validate required fields
    if (!petId || !veterinarianId || !dateTime || !type || !reason) {
      return res.status(400).json({
        error: { message: 'Missing required fields', code: 'MISSING_FIELDS' }
      });
    }

    // Verify pet ownership
    const petDoc = await db.collection('pets').doc(petId).get();
    if (!petDoc.exists || petDoc.data().ownerId !== uid) {
      return res.status(403).json({
        error: { message: 'Pet not found or access denied', code: 'PET_ACCESS_DENIED' }
      });
    }

    // Verify veterinarian exists and is approved
    const vetDoc = await db.collection('users').doc(veterinarianId).get();
    if (!vetDoc.exists || vetDoc.data().role !== 'veterinarian' || vetDoc.data().vetApplicationStatus !== 'approved') {
      return res.status(400).json({
        error: { message: 'Veterinarian not found or not approved', code: 'VET_NOT_AVAILABLE' }
      });
    }

    const appointmentDateTime = new Date(dateTime);
    if (appointmentDateTime <= new Date()) {
      return res.status(400).json({
        error: { message: 'Appointment must be in the future', code: 'INVALID_DATE' }
      });
    }

    // Check for conflicting appointments
    const startTime = admin.firestore.Timestamp.fromDate(appointmentDateTime);
    const endTime = admin.firestore.Timestamp.fromDate(
      new Date(appointmentDateTime.getTime() + duration * 60000)
    );

    const conflictingAppointments = await db.collection('appointments')
      .where('veterinarianId', '==', veterinarianId)
      .where('status', 'in', ['confirmed', 'pending'])
      .where('dateTime', '>=', startTime)
      .where('dateTime', '<', endTime)
      .get();

    if (!conflictingAppointments.empty) {
      return res.status(409).json({
        error: { message: 'Time slot is not available', code: 'TIME_CONFLICT' }
      });
    }

    const appointmentData = {
      ownerId: uid,
      petId,
      veterinarianId,
      dateTime: startTime,
      duration,
      type,
      reason: reason.trim(),
      notes: notes ? notes.trim() : null,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('appointments').add(appointmentData);

    // Create notification for veterinarian
    await db.collection('notifications').add({
      userId: veterinarianId,
      type: 'new_appointment',
      title: 'New Appointment Request',
      message: `New appointment request for ${petDoc.data().name}`,
      data: {
        appointmentId: docRef.id,
        petId,
        petName: petDoc.data().name
      },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      appointment: {
        id: docRef.id,
        ...appointmentData,
        dateTime: appointmentDateTime,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      error: { message: 'Failed to create appointment', code: 'CREATE_APPOINTMENT_FAILED' }
    });
  }
});

// Get appointments for the user
router.get('/', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { status, limit = 20, offset = 0, upcoming = false } = req.query;

    // Get user role to determine query
    const userDoc = await db.collection('users').doc(uid).get();
    const userRole = userDoc.data()?.role;

    let query;
    if (userRole === 'veterinarian') {
      query = db.collection('appointments').where('veterinarianId', '==', uid);
    } else {
      query = db.collection('appointments').where('ownerId', '==', uid);
    }

    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    if (upcoming === 'true') {
      query = query.where('dateTime', '>=', admin.firestore.Timestamp.now());
      query = query.orderBy('dateTime', 'asc');
    } else {
      query = query.orderBy('dateTime', 'desc');
    }

    const snapshot = await query
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    const appointments = [];
    const petIds = new Set();
    const vetIds = new Set();

    // Collect appointment data and related IDs
    snapshot.forEach(doc => {
      const appointmentData = doc.data();
      appointments.push({
        id: doc.id,
        ...appointmentData
      });
      petIds.add(appointmentData.petId);
      vetIds.add(appointmentData.veterinarianId);
    });

    // Fetch related pet and vet data
    const [pets, vets] = await Promise.all([
      Promise.all(Array.from(petIds).map(id => db.collection('pets').doc(id).get())),
      Promise.all(Array.from(vetIds).map(id => db.collection('users').doc(id).get()))
    ]);

    const petMap = new Map();
    const vetMap = new Map();

    pets.forEach(doc => {
      if (doc.exists) {
        petMap.set(doc.id, doc.data());
      }
    });

    vets.forEach(doc => {
      if (doc.exists) {
        const vetData = doc.data();
        vetMap.set(doc.id, {
          id: doc.id,
          firstName: vetData.firstName,
          lastName: vetData.lastName,
          specialization: vetData.specialization,
          email: vetData.email
        });
      }
    });

    // Combine appointment data with pet and vet info
    const enrichedAppointments = appointments.map(appointment => ({
      ...appointment,
      dateTime: appointment.dateTime?.toDate(),
      createdAt: appointment.createdAt?.toDate(),
      updatedAt: appointment.updatedAt?.toDate(),
      pet: petMap.get(appointment.petId),
      veterinarian: vetMap.get(appointment.veterinarianId)
    }));

    res.status(200).json({
      success: true,
      appointments: enrichedAppointments,
      hasMore: snapshot.size === parseInt(limit)
    });

  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      error: { message: 'Failed to get appointments', code: 'GET_APPOINTMENTS_FAILED' }
    });
  }
});

// Get a specific appointment
router.get('/:appointmentId', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { appointmentId } = req.params;

    const appointmentDoc = await db.collection('appointments').doc(appointmentId).get();

    if (!appointmentDoc.exists) {
      return res.status(404).json({
        error: { message: 'Appointment not found', code: 'APPOINTMENT_NOT_FOUND' }
      });
    }

    const appointmentData = appointmentDoc.data();

    // Check access rights
    if (appointmentData.ownerId !== uid && appointmentData.veterinarianId !== uid) {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }

    // Get related data
    const [petDoc, vetDoc] = await Promise.all([
      db.collection('pets').doc(appointmentData.petId).get(),
      db.collection('users').doc(appointmentData.veterinarianId).get()
    ]);

    const pet = petDoc.exists ? petDoc.data() : null;
    const vet = vetDoc.exists ? {
      id: vetDoc.id,
      firstName: vetDoc.data().firstName,
      lastName: vetDoc.data().lastName,
      specialization: vetDoc.data().specialization,
      email: vetDoc.data().email
    } : null;

    res.status(200).json({
      success: true,
      appointment: {
        id: appointmentId,
        ...appointmentData,
        dateTime: appointmentData.dateTime?.toDate(),
        createdAt: appointmentData.createdAt?.toDate(),
        updatedAt: appointmentData.updatedAt?.toDate(),
        pet,
        veterinarian: vet
      }
    });

  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      error: { message: 'Failed to get appointment', code: 'GET_APPOINTMENT_FAILED' }
    });
  }
});

// Update appointment status (for vets to confirm/reject)
router.patch('/:appointmentId/status', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { appointmentId } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['confirmed', 'cancelled', 'completed', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: { message: 'Invalid status', code: 'INVALID_STATUS' }
      });
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);
    const appointmentDoc = await appointmentRef.get();

    if (!appointmentDoc.exists) {
      return res.status(404).json({
        error: { message: 'Appointment not found', code: 'APPOINTMENT_NOT_FOUND' }
      });
    }

    const appointmentData = appointmentDoc.data();

    // Check permissions based on status change
    if (status === 'confirmed' || status === 'completed' || status === 'no_show') {
      // Only vet can confirm, complete, or mark no-show
      if (appointmentData.veterinarianId !== uid) {
        return res.status(403).json({
          error: { message: 'Only veterinarian can perform this action', code: 'VET_ONLY_ACTION' }
        });
      }
    } else if (status === 'cancelled') {
      // Both owner and vet can cancel
      if (appointmentData.ownerId !== uid && appointmentData.veterinarianId !== uid) {
        return res.status(403).json({
          error: { message: 'Access denied', code: 'ACCESS_DENIED' }
        });
      }
    }

    const updateData = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (reason) {
      updateData.statusReason = reason.trim();
    }

    if (status === 'confirmed') {
      updateData.confirmedAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (status === 'completed') {
      updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (status === 'cancelled') {
      updateData.cancelledAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await appointmentRef.update(updateData);

    // Create notification for the other party
    const notificationUserId = appointmentData.veterinarianId === uid 
      ? appointmentData.ownerId 
      : appointmentData.veterinarianId;

    let notificationMessage;
    switch (status) {
      case 'confirmed':
        notificationMessage = 'Your appointment has been confirmed';
        break;
      case 'cancelled':
        notificationMessage = 'Your appointment has been cancelled';
        break;
      case 'completed':
        notificationMessage = 'Your appointment has been completed';
        break;
      case 'no_show':
        notificationMessage = 'You were marked as no-show for your appointment';
        break;
    }

    await db.collection('notifications').add({
      userId: notificationUserId,
      type: 'appointment_status_change',
      title: 'Appointment Status Update',
      message: notificationMessage,
      data: {
        appointmentId,
        status,
        reason
      },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      message: 'Appointment status updated successfully'
    });

  } catch (error) {
    console.error('Update appointment status error:', error);
    res.status(500).json({
      error: { message: 'Failed to update appointment status', code: 'UPDATE_STATUS_FAILED' }
    });
  }
});

// Reschedule appointment
router.patch('/:appointmentId/reschedule', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { appointmentId } = req.params;
    const { newDateTime, reason } = req.body;

    if (!newDateTime) {
      return res.status(400).json({
        error: { message: 'New date and time required', code: 'MISSING_DATETIME' }
      });
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);
    const appointmentDoc = await appointmentRef.get();

    if (!appointmentDoc.exists) {
      return res.status(404).json({
        error: { message: 'Appointment not found', code: 'APPOINTMENT_NOT_FOUND' }
      });
    }

    const appointmentData = appointmentDoc.data();

    // Check access rights
    if (appointmentData.ownerId !== uid && appointmentData.veterinarianId !== uid) {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }

    const newAppointmentDateTime = new Date(newDateTime);
    if (newAppointmentDateTime <= new Date()) {
      return res.status(400).json({
        error: { message: 'New appointment time must be in the future', code: 'INVALID_DATE' }
      });
    }

    // Check for conflicts at new time
    const startTime = admin.firestore.Timestamp.fromDate(newAppointmentDateTime);
    const endTime = admin.firestore.Timestamp.fromDate(
      new Date(newAppointmentDateTime.getTime() + appointmentData.duration * 60000)
    );

    const conflictingAppointments = await db.collection('appointments')
      .where('veterinarianId', '==', appointmentData.veterinarianId)
      .where('status', 'in', ['confirmed', 'pending'])
      .where('dateTime', '>=', startTime)
      .where('dateTime', '<', endTime)
      .get();

    // Filter out the current appointment
    const hasConflict = conflictingAppointments.docs.some(doc => doc.id !== appointmentId);

    if (hasConflict) {
      return res.status(409).json({
        error: { message: 'New time slot is not available', code: 'TIME_CONFLICT' }
      });
    }

    await appointmentRef.update({
      dateTime: startTime,
      status: 'pending', // Reset to pending after rescheduling
      rescheduledAt: admin.firestore.FieldValue.serverTimestamp(),
      rescheduleReason: reason ? reason.trim() : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Notify the other party
    const notificationUserId = appointmentData.veterinarianId === uid 
      ? appointmentData.ownerId 
      : appointmentData.veterinarianId;

    await db.collection('notifications').add({
      userId: notificationUserId,
      type: 'appointment_rescheduled',
      title: 'Appointment Rescheduled',
      message: `Your appointment has been rescheduled to ${newAppointmentDateTime.toLocaleString()}`,
      data: {
        appointmentId,
        newDateTime: newAppointmentDateTime.toISOString(),
        reason
      },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully'
    });

  } catch (error) {
    console.error('Reschedule appointment error:', error);
    res.status(500).json({
      error: { message: 'Failed to reschedule appointment', code: 'RESCHEDULE_FAILED' }
    });
  }
});

// Get available time slots for a veterinarian
router.get('/availability/:veterinarianId', verifyToken, async (req, res) => {
  try {
    const { veterinarianId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        error: { message: 'Date parameter required', code: 'MISSING_DATE' }
      });
    }

    const requestedDate = new Date(date);
    if (isNaN(requestedDate.getTime()) || requestedDate < new Date().setHours(0, 0, 0, 0)) {
      return res.status(400).json({
        error: { message: 'Invalid date', code: 'INVALID_DATE' }
      });
    }

    // Get vet's schedule (this would be from a schedule collection in a real app)
    const vetDoc = await db.collection('users').doc(veterinarianId).get();
    if (!vetDoc.exists || vetDoc.data().role !== 'veterinarian') {
      return res.status(404).json({
        error: { message: 'Veterinarian not found', code: 'VET_NOT_FOUND' }
      });
    }

    // Get existing appointments for that day
    const dayStart = new Date(requestedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(requestedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const appointmentsSnapshot = await db.collection('appointments')
      .where('veterinarianId', '==', veterinarianId)
      .where('status', 'in', ['confirmed', 'pending'])
      .where('dateTime', '>=', admin.firestore.Timestamp.fromDate(dayStart))
      .where('dateTime', '<=', admin.firestore.Timestamp.fromDate(dayEnd))
      .get();

    const bookedSlots = [];
    appointmentsSnapshot.forEach(doc => {
      const appointment = doc.data();
      bookedSlots.push({
        start: appointment.dateTime.toDate(),
        duration: appointment.duration
      });
    });

    // Generate available slots (9 AM to 5 PM, 30-minute slots by default)
    const availableSlots = [];
    const workStart = new Date(requestedDate);
    workStart.setHours(9, 0, 0, 0);
    const workEnd = new Date(requestedDate);
    workEnd.setHours(17, 0, 0, 0);

    for (let time = new Date(workStart); time < workEnd; time.setMinutes(time.getMinutes() + 30)) {
      const slotTime = new Date(time);
      
      // Skip if slot is in the past
      if (slotTime <= new Date()) continue;

      // Check if slot conflicts with booked appointments
      const isBooked = bookedSlots.some(booked => {
        const bookedStart = booked.start;
        const bookedEnd = new Date(bookedStart.getTime() + booked.duration * 60000);
        return slotTime >= bookedStart && slotTime < bookedEnd;
      });

      if (!isBooked) {
        availableSlots.push(slotTime);
      }
    }

    res.status(200).json({
      success: true,
      date: date,
      veterinarianId,
      availableSlots
    });

  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      error: { message: 'Failed to get availability', code: 'GET_AVAILABILITY_FAILED' }
    });
  }
});

module.exports = router;