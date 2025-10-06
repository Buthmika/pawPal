const express = require('express');
const admin = require('firebase-admin');
const multer = require('multer');
const sharp = require('sharp');
const router = express.Router();

// Get Firebase services
const db = admin.firestore();
const storage = admin.storage();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

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

// Create a new pet
router.post('/', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const {
      name,
      type,
      breed,
      dateOfBirth,
      gender,
      color,
      weight,
      microchipNumber,
      description,
      medicalConditions,
      allergies,
      medications
    } = req.body;

    // Validate required fields
    if (!name || !type || !breed || !dateOfBirth || !gender) {
      return res.status(400).json({
        error: { message: 'Missing required fields', code: 'MISSING_FIELDS' }
      });
    }

    // Validate pet type
    const validTypes = ['dog', 'cat', 'bird', 'rabbit', 'hamster', 'guinea_pig', 'fish', 'reptile', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: { message: 'Invalid pet type', code: 'INVALID_PET_TYPE' }
      });
    }

    // Validate gender
    const validGenders = ['male', 'female', 'unknown'];
    if (!validGenders.includes(gender)) {
      return res.status(400).json({
        error: { message: 'Invalid gender', code: 'INVALID_GENDER' }
      });
    }

    // Validate date of birth
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime()) || birthDate > new Date()) {
      return res.status(400).json({
        error: { message: 'Invalid date of birth', code: 'INVALID_DATE' }
      });
    }

    const petData = {
      ownerId: uid,
      name: name.trim(),
      type,
      breed: breed.trim(),
      dateOfBirth: admin.firestore.Timestamp.fromDate(birthDate),
      gender,
      color: color ? color.trim() : null,
      weight: weight ? parseFloat(weight) : null,
      microchipNumber: microchipNumber ? microchipNumber.trim() : null,
      description: description ? description.trim() : null,
      medicalConditions: medicalConditions || [],
      allergies: allergies || [],
      medications: medications || [],
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('pets').add(petData);

    res.status(201).json({
      success: true,
      message: 'Pet created successfully',
      pet: {
        id: docRef.id,
        ...petData,
        dateOfBirth: birthDate,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Create pet error:', error);
    res.status(500).json({
      error: { message: 'Failed to create pet', code: 'CREATE_PET_FAILED' }
    });
  }
});

// Get all pets for the user
router.get('/', verifyToken, async (req, res) => {
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
    console.error('Get pets error:', error);
    res.status(500).json({
      error: { message: 'Failed to get pets', code: 'GET_PETS_FAILED' }
    });
  }
});

// Get a specific pet
router.get('/:petId', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { petId } = req.params;

    const petDoc = await db.collection('pets').doc(petId).get();

    if (!petDoc.exists) {
      return res.status(404).json({
        error: { message: 'Pet not found', code: 'PET_NOT_FOUND' }
      });
    }

    const petData = petDoc.data();

    // Check if user owns this pet
    if (petData.ownerId !== uid) {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }

    res.status(200).json({
      success: true,
      pet: {
        id: petId,
        ...petData,
        dateOfBirth: petData.dateOfBirth?.toDate(),
        createdAt: petData.createdAt?.toDate(),
        updatedAt: petData.updatedAt?.toDate(),
        nextVaccinationDate: petData.nextVaccinationDate?.toDate()
      }
    });

  } catch (error) {
    console.error('Get pet error:', error);
    res.status(500).json({
      error: { message: 'Failed to get pet', code: 'GET_PET_FAILED' }
    });
  }
});

// Update a pet
router.put('/:petId', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { petId } = req.params;
    const {
      name,
      type,
      breed,
      dateOfBirth,
      gender,
      color,
      weight,
      microchipNumber,
      description,
      medicalConditions,
      allergies,
      medications
    } = req.body;

    const petRef = db.collection('pets').doc(petId);
    const petDoc = await petRef.get();

    if (!petDoc.exists) {
      return res.status(404).json({
        error: { message: 'Pet not found', code: 'PET_NOT_FOUND' }
      });
    }

    const petData = petDoc.data();
    if (petData.ownerId !== uid) {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (name) updateData.name = name.trim();
    if (type) updateData.type = type;
    if (breed) updateData.breed = breed.trim();
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      if (!isNaN(birthDate.getTime()) && birthDate <= new Date()) {
        updateData.dateOfBirth = admin.firestore.Timestamp.fromDate(birthDate);
      }
    }
    if (gender) updateData.gender = gender;
    if (color !== undefined) updateData.color = color ? color.trim() : null;
    if (weight !== undefined) updateData.weight = weight ? parseFloat(weight) : null;
    if (microchipNumber !== undefined) updateData.microchipNumber = microchipNumber ? microchipNumber.trim() : null;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (medicalConditions) updateData.medicalConditions = medicalConditions;
    if (allergies) updateData.allergies = allergies;
    if (medications) updateData.medications = medications;

    await petRef.update(updateData);

    // Get updated pet data
    const updatedPet = await petRef.get();
    const updatedData = updatedPet.data();

    res.status(200).json({
      success: true,
      message: 'Pet updated successfully',
      pet: {
        id: petId,
        ...updatedData,
        dateOfBirth: updatedData.dateOfBirth?.toDate(),
        createdAt: updatedData.createdAt?.toDate(),
        updatedAt: updatedData.updatedAt?.toDate(),
        nextVaccinationDate: updatedData.nextVaccinationDate?.toDate()
      }
    });

  } catch (error) {
    console.error('Update pet error:', error);
    res.status(500).json({
      error: { message: 'Failed to update pet', code: 'UPDATE_PET_FAILED' }
    });
  }
});

// Delete a pet (soft delete)
router.delete('/:petId', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { petId } = req.params;

    const petRef = db.collection('pets').doc(petId);
    const petDoc = await petRef.get();

    if (!petDoc.exists) {
      return res.status(404).json({
        error: { message: 'Pet not found', code: 'PET_NOT_FOUND' }
      });
    }

    const petData = petDoc.data();
    if (petData.ownerId !== uid) {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }

    // Check for active appointments
    const activeAppointments = await db.collection('appointments')
      .where('petId', '==', petId)
      .where('status', 'in', ['confirmed', 'pending'])
      .get();

    if (!activeAppointments.empty) {
      return res.status(400).json({
        error: { 
          message: 'Cannot delete pet with active appointments', 
          code: 'ACTIVE_APPOINTMENTS_EXIST' 
        }
      });
    }

    // Soft delete
    await petRef.update({
      isActive: false,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      message: 'Pet deleted successfully'
    });

  } catch (error) {
    console.error('Delete pet error:', error);
    res.status(500).json({
      error: { message: 'Failed to delete pet', code: 'DELETE_PET_FAILED' }
    });
  }
});

// Upload pet photo
router.post('/:petId/photo', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    const { uid } = req.user;
    const { petId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        error: { message: 'No photo file provided', code: 'NO_FILE' }
      });
    }

    const petRef = db.collection('pets').doc(petId);
    const petDoc = await petRef.get();

    if (!petDoc.exists) {
      return res.status(404).json({
        error: { message: 'Pet not found', code: 'PET_NOT_FOUND' }
      });
    }

    const petData = petDoc.data();
    if (petData.ownerId !== uid) {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }

    // Process image with sharp
    const processedImageBuffer = await sharp(req.file.buffer)
      .resize(800, 600, {
        fit: 'cover',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Generate unique filename
    const fileName = `pets/${uid}/${petId}/${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
    
    // Upload to Firebase Storage
    const bucket = storage.bucket();
    const file = bucket.file(fileName);
    
    await file.save(processedImageBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          petId: petId,
          ownerId: uid,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    // Make file publicly readable
    await file.makePublic();

    const photoUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    // Update pet document with photo URL
    await petRef.update({
      photoUrl: photoUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      message: 'Photo uploaded successfully',
      photoUrl: photoUrl
    });

  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({
      error: { message: 'Failed to upload photo', code: 'UPLOAD_PHOTO_FAILED' }
    });
  }
});

// Get pet's medical records
router.get('/:petId/medical-records', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { petId } = req.params;

    // Verify pet ownership
    const petDoc = await db.collection('pets').doc(petId).get();
    if (!petDoc.exists || petDoc.data().ownerId !== uid) {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }

    const recordsSnapshot = await db.collection('medical-records')
      .where('petId', '==', petId)
      .orderBy('date', 'desc')
      .get();

    const records = [];
    recordsSnapshot.forEach(doc => {
      const recordData = doc.data();
      records.push({
        id: doc.id,
        ...recordData,
        date: recordData.date?.toDate(),
        createdAt: recordData.createdAt?.toDate(),
        updatedAt: recordData.updatedAt?.toDate()
      });
    });

    res.status(200).json({
      success: true,
      records
    });

  } catch (error) {
    console.error('Get medical records error:', error);
    res.status(500).json({
      error: { message: 'Failed to get medical records', code: 'GET_RECORDS_FAILED' }
    });
  }
});

// Add medical record
router.post('/:petId/medical-records', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { petId } = req.params;
    const {
      type,
      date,
      description,
      veterinarianId,
      diagnosis,
      treatment,
      medications,
      nextAppointment,
      notes
    } = req.body;

    // Verify pet ownership
    const petDoc = await db.collection('pets').doc(petId).get();
    if (!petDoc.exists || petDoc.data().ownerId !== uid) {
      return res.status(403).json({
        error: { message: 'Access denied', code: 'ACCESS_DENIED' }
      });
    }

    const recordData = {
      petId,
      ownerId: uid,
      type: type || 'general',
      date: admin.firestore.Timestamp.fromDate(new Date(date)),
      description: description ? description.trim() : '',
      veterinarianId: veterinarianId || null,
      diagnosis: diagnosis ? diagnosis.trim() : null,
      treatment: treatment ? treatment.trim() : null,
      medications: medications || [],
      nextAppointment: nextAppointment ? admin.firestore.Timestamp.fromDate(new Date(nextAppointment)) : null,
      notes: notes ? notes.trim() : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('medical-records').add(recordData);

    res.status(201).json({
      success: true,
      message: 'Medical record added successfully',
      record: {
        id: docRef.id,
        ...recordData,
        date: new Date(date),
        nextAppointment: nextAppointment ? new Date(nextAppointment) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Add medical record error:', error);
    res.status(500).json({
      error: { message: 'Failed to add medical record', code: 'ADD_RECORD_FAILED' }
    });
  }
});

module.exports = router;