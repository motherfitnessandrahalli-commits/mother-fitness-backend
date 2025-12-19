# Mother Fitness Gym Management System

## Setup Instructions

### 1. Prerequisites
- Node.js installed (Version 18 or higher recommended).
- A valid MongoDB connection string.
- A Gmail account with an "App Password" for sending emails.

### 2. Installation
Open a terminal in this directory and run:
```bash
npm install
```

### 3. Configuration

#### Backend Secrets (.env)
1. Rename `.env.example` to `.env`.
2. Open `.env` and fill in your details:
   - `MONGODB_URI`: Your MongoDB connection string.
   - `EMAIL_USER`: Your Gmail address.
   - `EMAIL_PASSWORD`: Your Gmail App Password (NOT your regular password).

#### Frontend Settings (public/config.js)
1. Open `public/config.js`.
2. Update `API_BASE_URL` to point to your deployed backend URL (or `http://localhost:5000` for local testing).
3. Do the same for `member-app/config.js` if you are using the member portal.

### 4. Running the Application

To start the server:
```bash
npm start
```

The application will be available at: `http://localhost:5000`

## Important Note
This package has been cleaned of all previous user data and personal credentials. You **must** configure the `.env` file for the system to work.
