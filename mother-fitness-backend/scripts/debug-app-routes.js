console.log('🔍 Analyzing Application Routes...');

let app;
try {
    app = require('../src/app');
} catch (err) {
    console.error('❌ CRITICAL ERROR requiring app.js:', err);
    process.exit(1);
}

try {
    const endpoints = listEndpoints(app);

    // Filter for admin-profile
    const adminRoutes = endpoints.filter(e => e.path.includes('admin-profile'));

    if (adminRoutes.length > 0) {
        console.log('✅ Admin Profile Routes FOUND:');
        console.log(JSON.stringify(adminRoutes, null, 2));
    } else {
        console.error('❌ Admin Profile Routes NOT FOUND in app instance.');
    }

    console.log('\n--- All Registered API Routes ---');
    endpoints.forEach(e => {
        if (e.path.startsWith('/api')) {
            console.log(`${e.methods.join(',')} ${e.path}`);
        }
    });

} catch (error) {
    console.error('Error analyzing routes:', error);
}
