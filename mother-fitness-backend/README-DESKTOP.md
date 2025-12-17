# Mother Fitness - Desktop Application

## Overview

This is the standalone Windows desktop application for the Mother Fitness Gym Management System. The application bundles both the backend server and frontend interface into a single executable that runs without requiring a web browser or manual server setup.

## Prerequisites

Before running this application, ensure you have:

1. **MongoDB Database**: The application requires a MongoDB database connection
   - Local MongoDB installation, OR
   - MongoDB Atlas cloud database connection string

2. **Environment Configuration**: The `.env` file must be present in the same directory as the executable with your MongoDB connection details

## Configuration

### Setting up the .env file

The `.env` file should be located in the same directory as the application executable. Here's a template:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/mother-fitness
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mother-fitness

# Server Configuration
PORT=5000
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=30d

# Email Configuration (EmailJS)
EMAILJS_SERVICE_ID=your_service_id
EMAILJS_TEMPLATE_ID=your_template_id
EMAILJS_PUBLIC_KEY=your_public_key

# Admin Email
ADMIN_EMAIL=admin@motherfitness.com

# CORS Settings
CORS_ORIGIN=http://localhost:5000
```

**Important**: Make sure to update these values with your actual credentials before running the application.

## Installation

### For End Users (Using the Installer)

1. Download the `Mother Fitness Admin Setup.exe` installer
2. Run the installer and follow the installation wizard
3. Choose your installation directory
4. The installer will create desktop and start menu shortcuts
5. Place your `.env` file in the installation directory (typically `C:\Program Files\Mother Fitness Admin`)
6. Launch the application from the desktop shortcut or start menu

### For Portable Version

1. Download the portable `.exe` file
2. Create a folder for the application (e.g., `C:\MotherFitness`)
3. Place the `.exe` file in the folder
4. Create or copy your `.env` file to the same folder
5. Double-click the `.exe` to run

## Running the Application

1. **First Launch**:
   - Ensure MongoDB is running (if using local MongoDB)
   - Double-click the application icon
   - The application will start the backend server automatically
   - The admin interface will open in a window

2. **Default Login**:
   - Email: `admin@motherfitness.com`
   - Password: `111111`
   - **Important**: Change the default password after first login!

## Features

### Admin Dashboard
- Member management (add, edit, delete customers)
- Payment tracking and history
- Attendance monitoring via QR code scanning
- Analytics and reporting
- Announcements system
- Excel import/export functionality

### Member Application
- Accessible from the hamburger menu or at `/member-app`
- Member dashboard with personal stats
- Attendance history
- Badge achievements
- BMI calculator
- View announcements

## Troubleshooting

### Application won't start

**Problem**: Application shows an error on startup
**Solutions**:
1. Verify MongoDB is running and accessible
2. Check your `.env` file is in the correct location
3. Verify MongoDB connection string is correct
4. Check that port 5000 is not already in use
5. Look for error logs in the application data folder

### "Port already in use" error

**Problem**: Error message about port 5000 being in use
**Solutions**:
1. Close any other instances of the application
2. Close any other programs using port 5000
3. Change the `PORT` value in your `.env` file to another port (e.g., 5001)

### Cannot connect to MongoDB

**Problem**: "Failed to connect to MongoDB" error
**Solutions**:
1. If using local MongoDB:
   - Start the MongoDB service
   - Verify MongoDB is running on port 27017
2. If using MongoDB Atlas:
   - Check your internet connection
   - Verify the connection string is correct
   - Ensure your IP address is whitelisted in Atlas
   - Check database user credentials

### Login not working

**Problem**: "Invalid credentials" error
**Solutions**:
1. Ensure the admin user exists in the database
2. Run the `reset-admin.js` script to recreate the admin user:
   - Navigate to the application installation folder
   - Run: `node reset-admin.js`
3. Verify you're using the correct email and password

## Development

### Running in Development Mode

```bash
# Install dependencies
npm install

# Run in Electron development mode
npm run electron:dev
```

### Building the Application

```bash
# Build Windows installer
npm run electron:build

# Build portable executable
npm run electron:build-portable
```

The built application will be in the `dist/` directory.

## File Locations

- **Application Data**: `%APPDATA%\Mother Fitness Admin\`
- **Logs**: Check the application data folder for log files
- **Uploads**: Member photos are stored in the `uploads/` directory
- **Database**: Configured via `.env` file

## Keyboard Shortcuts

- `Ctrl+R` - Reload the application
- `Ctrl+Q` - Quit the application
- `F11` - Toggle fullscreen
- `Ctrl+Shift+I` - Toggle developer tools (for debugging)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the log files for error messages
3. Contact: Built by Black Embracing

## Version Information

- **Version**: 6.3
- **Type**: Windows Desktop Application
- **Framework**: Electron
- **Backend**: Node.js + Express
- **Database**: MongoDB

## Security Notes

1. **Change Default Password**: Always change the default admin password after installation
2. **Protect .env File**: Keep your `.env` file secure and never share it
3. **MongoDB Security**: Use strong passwords and enable authentication on your MongoDB instance
4. **Firewall**: The application only listens on localhost (127.0.0.1) for security

## License

Proprietary - Mother Fitness Gym Management System
