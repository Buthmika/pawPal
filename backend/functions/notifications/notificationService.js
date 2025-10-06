const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Get Firestore instance
const db = admin.firestore();

// Configure email transporter (using Gmail as example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Create notification in database
async function createNotification(userId, type, title, message, data = {}) {
  try {
    await db.collection('notifications').add({
      userId,
      type,
      title,
      message,
      data,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Send email notification
async function sendEmail(to, subject, htmlContent, textContent = null) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('Email credentials not configured, skipping email send');
      return;
    }

    const mailOptions = {
      from: `"PawPal" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Send appointment notification
async function sendAppointmentNotification(appointmentId, notificationType) {
  try {
    const appointmentDoc = await db.collection('appointments').doc(appointmentId).get();
    if (!appointmentDoc.exists) {
      throw new Error('Appointment not found');
    }

    const appointment = appointmentDoc.data();
    
    // Get pet and owner/vet information
    const [petDoc, ownerDoc, vetDoc] = await Promise.all([
      db.collection('pets').doc(appointment.petId).get(),
      db.collection('users').doc(appointment.ownerId).get(),
      db.collection('users').doc(appointment.veterinarianId).get()
    ]);

    const pet = petDoc.data();
    const owner = ownerDoc.data();
    const vet = vetDoc.data();

    let notification = {};
    let emailSubject = '';
    let emailContent = '';

    switch (notificationType) {
      case 'new_appointment':
        // Notify veterinarian about new appointment request
        notification = {
          userId: appointment.veterinarianId,
          type: 'new_appointment',
          title: 'New Appointment Request',
          message: `${owner.firstName} ${owner.lastName} has requested an appointment for ${pet.name}`,
          data: {
            appointmentId,
            petName: pet.name,
            ownerName: `${owner.firstName} ${owner.lastName}`,
            dateTime: appointment.dateTime.toDate().toISOString()
          }
        };

        emailSubject = 'New Appointment Request - PawPal';
        emailContent = `
          <h2>New Appointment Request</h2>
          <p>Hello Dr. ${vet.firstName} ${vet.lastName},</p>
          <p>You have received a new appointment request:</p>
          <ul>
            <li><strong>Pet:</strong> ${pet.name}</li>
            <li><strong>Owner:</strong> ${owner.firstName} ${owner.lastName}</li>
            <li><strong>Date & Time:</strong> ${appointment.dateTime.toDate().toLocaleString()}</li>
            <li><strong>Reason:</strong> ${appointment.reason}</li>
          </ul>
          <p>Please log in to your PawPal account to review and confirm this appointment.</p>
          <p>Best regards,<br>The PawPal Team</p>
        `;

        await createNotification(
          notification.userId,
          notification.type,
          notification.title,
          notification.message,
          notification.data
        );

        if (vet.email) {
          await sendEmail(vet.email, emailSubject, emailContent);
        }
        break;

      case 'status_change':
        // Notify owner about appointment status change
        let statusMessage = '';
        switch (appointment.status) {
          case 'confirmed':
            statusMessage = 'confirmed';
            break;
          case 'cancelled':
            statusMessage = 'cancelled';
            break;
          case 'completed':
            statusMessage = 'completed';
            break;
          case 'no_show':
            statusMessage = 'marked as no-show';
            break;
        }

        notification = {
          userId: appointment.ownerId,
          type: 'appointment_status_change',
          title: 'Appointment Status Update',
          message: `Your appointment for ${pet.name} has been ${statusMessage}`,
          data: {
            appointmentId,
            petName: pet.name,
            status: appointment.status,
            dateTime: appointment.dateTime.toDate().toISOString()
          }
        };

        emailSubject = `Appointment ${statusMessage.charAt(0).toUpperCase() + statusMessage.slice(1)} - PawPal`;
        emailContent = `
          <h2>Appointment Status Update</h2>
          <p>Hello ${owner.firstName},</p>
          <p>Your appointment for ${pet.name} has been ${statusMessage}.</p>
          <ul>
            <li><strong>Veterinarian:</strong> Dr. ${vet.firstName} ${vet.lastName}</li>
            <li><strong>Date & Time:</strong> ${appointment.dateTime.toDate().toLocaleString()}</li>
            <li><strong>Status:</strong> ${statusMessage.charAt(0).toUpperCase() + statusMessage.slice(1)}</li>
          </ul>
          <p>Please log in to your PawPal account for more details.</p>
          <p>Best regards,<br>The PawPal Team</p>
        `;

        await createNotification(
          notification.userId,
          notification.type,
          notification.title,
          notification.message,
          notification.data
        );

        if (owner.email) {
          await sendEmail(owner.email, emailSubject, emailContent);
        }
        break;
    }

  } catch (error) {
    console.error('Error sending appointment notification:', error);
    throw error;
  }
}

// Send vaccination reminder
async function sendVaccinationReminder(petId, petData) {
  try {
    const ownerDoc = await db.collection('users').doc(petData.ownerId).get();
    const owner = ownerDoc.data();

    const notification = {
      userId: petData.ownerId,
      type: 'vaccination_reminder',
      title: 'Vaccination Reminder',
      message: `${petData.name} is due for vaccination soon`,
      data: {
        petId,
        petName: petData.name,
        nextVaccinationDate: petData.nextVaccinationDate?.toDate().toISOString()
      }
    };

    await createNotification(
      notification.userId,
      notification.type,
      notification.title,
      notification.message,
      notification.data
    );

    if (owner.email && petData.nextVaccinationDate) {
      const emailSubject = 'Vaccination Reminder - PawPal';
      const emailContent = `
        <h2>Vaccination Reminder</h2>
        <p>Hello ${owner.firstName},</p>
        <p>This is a friendly reminder that ${petData.name} is due for vaccination on ${petData.nextVaccinationDate.toDate().toLocaleDateString()}.</p>
        <p>Please schedule an appointment with your veterinarian to keep ${petData.name} healthy and up-to-date with their vaccinations.</p>
        <p>You can book an appointment through your PawPal account.</p>
        <p>Best regards,<br>The PawPal Team</p>
      `;

      await sendEmail(owner.email, emailSubject, emailContent);
    }

  } catch (error) {
    console.error('Error sending vaccination reminder:', error);
    throw error;
  }
}

// Send appointment reminder
async function sendAppointmentReminder(appointmentId, appointmentData) {
  try {
    const [petDoc, ownerDoc, vetDoc] = await Promise.all([
      db.collection('pets').doc(appointmentData.petId).get(),
      db.collection('users').doc(appointmentData.ownerId).get(),
      db.collection('users').doc(appointmentData.veterinarianId).get()
    ]);

    const pet = petDoc.data();
    const owner = ownerDoc.data();
    const vet = vetDoc.data();

    // Send reminder to owner
    const ownerNotification = {
      userId: appointmentData.ownerId,
      type: 'appointment_reminder',
      title: 'Appointment Reminder',
      message: `Don't forget about ${pet.name}'s appointment tomorrow with Dr. ${vet.firstName} ${vet.lastName}`,
      data: {
        appointmentId,
        petName: pet.name,
        vetName: `Dr. ${vet.firstName} ${vet.lastName}`,
        dateTime: appointmentData.dateTime.toDate().toISOString()
      }
    };

    await createNotification(
      ownerNotification.userId,
      ownerNotification.type,
      ownerNotification.title,
      ownerNotification.message,
      ownerNotification.data
    );

    if (owner.email) {
      const ownerEmailSubject = 'Appointment Reminder - PawPal';
      const ownerEmailContent = `
        <h2>Appointment Reminder</h2>
        <p>Hello ${owner.firstName},</p>
        <p>This is a reminder about ${pet.name}'s upcoming appointment:</p>
        <ul>
          <li><strong>Veterinarian:</strong> Dr. ${vet.firstName} ${vet.lastName}</li>
          <li><strong>Date & Time:</strong> ${appointmentData.dateTime.toDate().toLocaleString()}</li>
          <li><strong>Reason:</strong> ${appointmentData.reason}</li>
        </ul>
        <p>Please make sure to arrive on time. If you need to reschedule, please do so through your PawPal account.</p>
        <p>Best regards,<br>The PawPal Team</p>
      `;

      await sendEmail(owner.email, ownerEmailSubject, ownerEmailContent);
    }

    // Send reminder to veterinarian
    const vetNotification = {
      userId: appointmentData.veterinarianId,
      type: 'appointment_reminder',
      title: 'Appointment Reminder',
      message: `Upcoming appointment tomorrow: ${pet.name} with ${owner.firstName} ${owner.lastName}`,
      data: {
        appointmentId,
        petName: pet.name,
        ownerName: `${owner.firstName} ${owner.lastName}`,
        dateTime: appointmentData.dateTime.toDate().toISOString()
      }
    };

    await createNotification(
      vetNotification.userId,
      vetNotification.type,
      vetNotification.title,
      vetNotification.message,
      vetNotification.data
    );

    if (vet.email) {
      const vetEmailSubject = 'Appointment Reminder - PawPal';
      const vetEmailContent = `
        <h2>Appointment Reminder</h2>
        <p>Hello Dr. ${vet.firstName},</p>
        <p>You have an upcoming appointment tomorrow:</p>
        <ul>
          <li><strong>Pet:</strong> ${pet.name}</li>
          <li><strong>Owner:</strong> ${owner.firstName} ${owner.lastName}</li>
          <li><strong>Date & Time:</strong> ${appointmentData.dateTime.toDate().toLocaleString()}</li>
          <li><strong>Reason:</strong> ${appointmentData.reason}</li>
        </ul>
        <p>Please review the pet's medical history before the appointment.</p>
        <p>Best regards,<br>The PawPal Team</p>
      `;

      await sendEmail(vet.email, vetEmailSubject, vetEmailContent);
    }

  } catch (error) {
    console.error('Error sending appointment reminder:', error);
    throw error;
  }
}

// Send welcome email to new users
async function sendWelcomeEmail(userId, userData) {
  try {
    if (!userData.email) return;

    const emailSubject = 'Welcome to PawPal!';
    const emailContent = `
      <h2>Welcome to PawPal, ${userData.firstName}!</h2>
      <p>Thank you for joining the PawPal community - the best place to manage your pet's health and care.</p>
      <p>With PawPal, you can:</p>
      <ul>
        <li>Create profiles for all your pets</li>
        <li>Store vaccination records and medical history</li>
        <li>Book appointments with qualified veterinarians</li>
        <li>Receive timely reminders for vaccinations and checkups</li>
        <li>Access your pet's information anytime, anywhere</li>
      </ul>
      <p>Get started by adding your first pet to your account!</p>
      <p><a href="${process.env.FRONTEND_URL}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Access Your Account</a></p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p>Best regards,<br>The PawPal Team</p>
    `;

    await sendEmail(userData.email, emailSubject, emailContent);

    // Create welcome notification
    await createNotification(
      userId,
      'welcome',
      'Welcome to PawPal!',
      'Thank you for joining PawPal. Start by adding your first pet to your account.',
      { isWelcome: true }
    );

  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

// Send veterinarian application status email
async function sendVetApplicationStatusEmail(userId, status, reason = null) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData.email) return;

    let emailSubject = '';
    let emailContent = '';

    if (status === 'approved') {
      emailSubject = 'Veterinarian Application Approved - PawPal';
      emailContent = `
        <h2>Congratulations Dr. ${userData.firstName} ${userData.lastName}!</h2>
        <p>We're excited to inform you that your veterinarian application has been approved.</p>
        <p>You can now:</p>
        <ul>
          <li>Receive and manage appointment requests</li>
          <li>Update your professional profile</li>
          <li>Access patient medical records during appointments</li>
          <li>Set your availability and schedule</li>
        </ul>
        <p>Welcome to the PawPal veterinarian community!</p>
        <p><a href="${process.env.FRONTEND_URL}/vet-dashboard" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Access Your Vet Dashboard</a></p>
        <p>Best regards,<br>The PawPal Team</p>
      `;
    } else if (status === 'rejected') {
      emailSubject = 'Veterinarian Application Update - PawPal';
      emailContent = `
        <h2>Veterinarian Application Update</h2>
        <p>Dear ${userData.firstName} ${userData.lastName},</p>
        <p>Thank you for your interest in joining PawPal as a veterinarian.</p>
        <p>After careful review, we are unable to approve your application at this time.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>You are welcome to reapply in the future if your circumstances change.</p>
        <p>If you have any questions about this decision, please contact our support team.</p>
        <p>Best regards,<br>The PawPal Team</p>
      `;
    }

    await sendEmail(userData.email, emailSubject, emailContent);

    // Create notification
    await createNotification(
      userId,
      'vet_application_status',
      status === 'approved' ? 'Application Approved!' : 'Application Update',
      status === 'approved' 
        ? 'Congratulations! Your veterinarian application has been approved.'
        : 'Your veterinarian application has been reviewed.',
      { status, reason }
    );

  } catch (error) {
    console.error('Error sending vet application status email:', error);
  }
}

module.exports = {
  createNotification,
  sendEmail,
  sendAppointmentNotification,
  sendVaccinationReminder,
  sendAppointmentReminder,
  sendWelcomeEmail,
  sendVetApplicationStatusEmail
};