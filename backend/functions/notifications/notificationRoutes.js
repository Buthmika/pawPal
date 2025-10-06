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

// Get user notifications
router.get('/', verifyToken, async (req, res) => {
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
router.patch('/:notificationId/read', verifyToken, async (req, res) => {
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
router.patch('/read-all', verifyToken, async (req, res) => {
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

// Delete notification
router.delete('/:notificationId', verifyToken, async (req, res) => {
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

    await notificationRef.delete();

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      error: { message: 'Failed to delete notification', code: 'DELETE_FAILED' }
    });
  }
});

// Get notification counts
router.get('/counts', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    const [totalSnapshot, unreadSnapshot] = await Promise.all([
      db.collection('notifications').where('userId', '==', uid).get(),
      db.collection('notifications').where('userId', '==', uid).where('read', '==', false).get()
    ]);

    res.status(200).json({
      success: true,
      counts: {
        total: totalSnapshot.size,
        unread: unreadSnapshot.size
      }
    });

  } catch (error) {
    console.error('Get notification counts error:', error);
    res.status(500).json({
      error: { message: 'Failed to get notification counts', code: 'GET_COUNTS_FAILED' }
    });
  }
});

module.exports = router;