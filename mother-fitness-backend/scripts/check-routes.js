const app = require('../src/app');

console.log('--- CHECKING ROUTES WITHOUT DEPENDENCIES ---');

function printRoutes(stack) {
    if (!stack) return;

    stack.forEach(layer => {
        if (layer.route) {
            console.log(`ROUTE: ${layer.route.path}`);
        } else if (layer.name === 'router' && layer.handle.stack) {
            // This is a mounted router
            // We can't easily get the base path from here without regex parsing (layer.regexp)
            // But we can check if it looks like our admin profile router
            console.log(`Mounted Router with regex: ${layer.regexp}`);
            if (layer.regexp.toString().includes('admin-profile')) {
                console.log('✅ FOUND: /api/admin-profile router is mounted!');
            }
            printRoutes(layer.handle.stack);
        }
    });
}

try {
    if (app._router && app._router.stack) {
        printRoutes(app._router.stack);
    } else {
        console.log('App router stack not initialized immediately. Emulating start...');
        // Sometimes app is not fully initialized until listen() or some middleware running
        // But app.use() happens synchronously, so stack should be populated.
    }
} catch (error) {
    console.error('Error:', error);
}
console.log('--- END CHECK ---');
