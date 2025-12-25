// ===================================
// Client Configuration
// ===================================

// This file is safe to edit. It will not be overwritten by software updates
// unless significant structural changes are required.

window.APP_CONFIG = {
    // URL of your deployed backend (e.g., on Render or local IP)
    // Localhost example: 'http://localhost:5000'
    // Render example: 'https://your-app-name.onrender.com'
    API_BASE_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.'))
        ? `${window.location.protocol}//${window.location.hostname}:5000`
        : 'https://mother-fitness-backend.onrender.com',

    // Gym Name for display titles
    GYM_NAME: 'Mother Fitness'
};
