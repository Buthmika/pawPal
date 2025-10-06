# PawPal Backend Functions

This directory contains the Firebase Cloud Functions for the PawPal application backend.

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend/functions
npm install
```

### 2. Configure Environment Variables
1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` file and set your configuration:
   - `FRONTEND_URL`: Your deployed frontend URL
   - `EMAIL_USER`: Email address for sending notifications
   - `EMAIL_PASSWORD`: App password for email service
   - Other settings as needed

### 3. Firebase Configuration
1. Make sure you have Firebase CLI installed:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize the project (if not already done):
```bash
firebase init functions
```

### 4. Deploy Functions
1. Deploy all functions:
```bash
firebase deploy --only functions
```

2. Deploy specific function:
```bash
firebase deploy --only functions:api
```

### 5. Local Development
1. Start the Firebase emulator:
```bash
firebase emulators:start
```

2. The API will be available at:
```
http://localhost:5001/[PROJECT-ID]/us-central1/api
```

## API Endpoints

### Authentication Routes (`/auth`)
- `POST /auth/update-profile` - Update user profile after authentication
- `GET /auth/profile` - Get user profile
- `POST /auth/change-password` - Change user password
- `POST /auth/verify-email` - Send email verification
- `DELETE /auth/account` - Delete user account
- `POST /auth/recover` - Recover deleted account

### User Routes (`/users`)
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update user profile
- `GET /users/pets` - Get user's pets
- `GET /users/appointments` - Get user's appointments
- `GET /users/notifications` - Get user notifications
- `PATCH /users/notifications/:id/read` - Mark notification as read
- `PATCH /users/notifications/read-all` - Mark all notifications as read
- `PATCH /users/preferences` - Update user preferences
- `GET /users/stats` - Get user statistics

### Pet Routes (`/pets`)
- `POST /pets` - Create a new pet
- `GET /pets` - Get all pets for user
- `GET /pets/:id` - Get specific pet
- `PUT /pets/:id` - Update pet
- `DELETE /pets/:id` - Delete pet (soft delete)
- `POST /pets/:id/photo` - Upload pet photo
- `GET /pets/:id/medical-records` - Get pet's medical records
- `POST /pets/:id/medical-records` - Add medical record

### Appointment Routes (`/appointments`)
- `POST /appointments` - Create new appointment
- `GET /appointments` - Get user's appointments
- `GET /appointments/:id` - Get specific appointment
- `PATCH /appointments/:id/status` - Update appointment status
- `PATCH /appointments/:id/reschedule` - Reschedule appointment
- `GET /appointments/availability/:vetId` - Get vet availability

### Veterinarian Routes (`/vets`)
- `POST /vets/apply` - Apply to become a veterinarian
- `GET /vets` - Get list of veterinarians (public)
- `GET /vets/:id` - Get veterinarian profile
- `PUT /vets/profile` - Update vet profile (vet only)
- `GET /vets/appointments/mine` - Get vet's appointments
- `GET /vets/stats/dashboard` - Get vet dashboard stats
- `GET /vets/meta/specializations` - Get available specializations

### Notification Routes (`/notifications`)
- `GET /notifications` - Get user notifications
- `PATCH /notifications/:id/read` - Mark notification as read
- `PATCH /notifications/read-all` - Mark all notifications as read
- `DELETE /notifications/:id` - Delete notification
- `GET /notifications/counts` - Get notification counts

### Admin Routes (`/admin`)
- `GET /admin/dashboard/stats` - Get admin dashboard statistics
- `GET /admin/veterinarians/applications` - Get pending vet applications
- `PATCH /admin/veterinarians/:id/application` - Approve/reject vet application
- `GET /admin/users` - Get all users with filters
- `PATCH /admin/users/:id/status` - Activate/deactivate user
- `GET /admin/activities` - Get system activities
- `GET /admin/config` - Get system configuration

## Scheduled Functions

### `sendVaccinationReminders`
- Runs daily at 9 AM
- Sends reminders for pets with upcoming vaccinations

### `sendAppointmentReminders`
- Runs daily at 8 AM
- Sends reminders for appointments tomorrow

## Firestore Triggers

### `onUserCreate`
- Triggered when a new user signs up
- Creates user document in Firestore

### `onUserDelete`
- Triggered when user account is deleted
- Cleans up user data

### `onAppointmentCreate`
- Triggered when new appointment is created
- Sends notification to veterinarian

### `onAppointmentUpdate`
- Triggered when appointment is updated
- Sends status change notifications

## Security

All routes (except public vet listing) require Firebase Authentication.
Admin routes require admin role verification.
Users can only access their own data unless they're admins or vets accessing appointment data.

## Environment Variables

- `FRONTEND_URL`: URL of the frontend application
- `EMAIL_USER`: Email address for sending notifications
- `EMAIL_PASSWORD`: Password/app password for email service
- `TIMEZONE`: Timezone for scheduled functions (default: America/New_York)

## Error Handling

All endpoints return consistent error responses:
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "timestamp": "2023-01-01T00:00:00.000Z"
  }
}
```

## Testing

To test the functions locally:

1. Start the emulator:
```bash
firebase emulators:start
```

2. Use the local endpoint:
```
http://localhost:5001/[PROJECT-ID]/us-central1/api
```

3. Include Firebase Auth token in requests:
```javascript
headers: {
  'Authorization': 'Bearer ' + idToken,
  'Content-Type': 'application/json'
}
```