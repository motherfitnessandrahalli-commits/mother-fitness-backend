// ===================================
// Client Configuration
// ===================================

window.APP_CONFIG = {
    // URL of your deployed backend
    API_BASE_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.'))
        ? `${window.location.protocol}//${window.location.hostname}:5000`
        : 'https://mother-fitness-backend.onrender.com',

    // Gym Name
    GYM_NAME: 'Mother Fitness'
};
