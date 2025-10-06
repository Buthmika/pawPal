const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Initialize Firestore and other services
const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

// Create Express app
const app = express();

// Configure CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Import route handlers
const authRoutes = require('./auth/authRoutes');
const userRoutes = require('./users/userRoutes');
const petRoutes = require('./pets/petRoutes');
const appointmentRoutes = require('./appointments/appointmentRoutes');
const vetRoutes = require('./vets/vetRoutes');
const notificationRoutes = require('./notifications/notificationRoutes');
const adminRoutes = require('./admin/adminRoutes');

// Use routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/pets', petRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/vets', vetRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
      path: req.path
    }
  });
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);

// Auth triggers
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  try {
    // Create user document in Firestore when user signs up
    await db.collection('users').doc(user.uid).set({
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      role: 'pet_owner' // Default role
    }, { merge: true });

    console.log('User document created for:', user.email);
  } catch (error) {
    console.error('Error creating user document:', error);
  }
});

exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
  try {
    // Clean up user data when account is deleted
    const batch = db.batch();
    
    // Delete user document
    const userRef = db.collection('users').doc(user.uid);
    batch.delete(userRef);
    
    // Delete user's pets
    const petsSnapshot = await db.collection('pets').where('ownerId', '==', user.uid).get();
    petsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete user's appointments
    const appointmentsSnapshot = await db.collection('appointments')
      .where('ownerId', '==', user.uid).get();
    appointmentsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log('User data cleaned up for:', user.email);
  } catch (error) {
    console.error('Error cleaning up user data:', error);
  }
});

// Firestore triggers
exports.onAppointmentCreate = functions.firestore
  .document('appointments/{appointmentId}')
  .onCreate(async (snap, context) => {
    try {
      const appointment = snap.data();
      const appointmentId = context.params.appointmentId;
      
      // Send notification to vet about new appointment
      await sendAppointmentNotification(appointmentId, 'new_appointment');
      
      console.log('New appointment created:', appointmentId);
    } catch (error) {
      console.error('Error handling new appointment:', error);
    }
  });

exports.onAppointmentUpdate = functions.firestore
  .document('appointments/{appointmentId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data();
      const after = change.after.data();
      const appointmentId = context.params.appointmentId;
      
      // Check if status changed
      if (before.status !== after.status) {
        await sendAppointmentNotification(appointmentId, 'status_change');
      }
      
      console.log('Appointment updated:', appointmentId);
    } catch (error) {
      console.error('Error handling appointment update:', error);
    }
  });

// Scheduled functions
exports.sendVaccinationReminders = functions.pubsub
  .schedule('0 9 * * *') // Daily at 9 AM
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      console.log('Running vaccination reminders...');
      
      // Get pets with upcoming vaccinations
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      const petsSnapshot = await db.collection('pets')
        .where('nextVaccinationDate', '<=', threeDaysFromNow)
        .where('isActive', '==', true)
        .get();
      
      const notifications = [];
      
      petsSnapshot.forEach(doc => {
        const pet = doc.data();
        notifications.push(sendVaccinationReminder(doc.id, pet));
      });
      
      await Promise.all(notifications);
      
      console.log(`Sent ${notifications.length} vaccination reminders`);
    } catch (error) {
      console.error('Error sending vaccination reminders:', error);
    }
  });

exports.sendAppointmentReminders = functions.pubsub
  .schedule('0 8 * * *') // Daily at 8 AM
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      console.log('Running appointment reminders...');
      
      // Get appointments for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
      
      const appointmentsSnapshot = await db.collection('appointments')
        .where('dateTime', '>=', tomorrow)
        .where('dateTime', '<', dayAfterTomorrow)
        .where('status', '==', 'confirmed')
        .get();
      
      const notifications = [];
      
      appointmentsSnapshot.forEach(doc => {
        const appointment = doc.data();
        notifications.push(sendAppointmentReminder(doc.id, appointment));
      });
      
      await Promise.all(notifications);
      
      console.log(`Sent ${notifications.length} appointment reminders`);
    } catch (error) {
      console.error('Error sending appointment reminders:', error);
    }
  });

// Helper functions
async function sendAppointmentNotification(appointmentId, type) {
  // Implementation will be in notification service
  const { sendAppointmentNotification } = require('./notifications/notificationService');
  return sendAppointmentNotification(appointmentId, type);
}

async function sendVaccinationReminder(petId, petData) {
  // Implementation will be in notification service
  const { sendVaccinationReminder } = require('./notifications/notificationService');
  return sendVaccinationReminder(petId, petData);
}

async function sendAppointmentReminder(appointmentId, appointmentData) {
  // Implementation will be in notification service
  const { sendAppointmentReminder } = require('./notifications/notificationService');
  return sendAppointmentReminder(appointmentId, appointmentData);
}

// Export admin and db for use in other modules
module.exports = { admin, db, auth, storage };