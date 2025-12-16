const fs = require('fs');
const path = require('path');

const sourceDir = __dirname;
const targetDir = path.join(__dirname, 'Client-Delivery', 'mother-fitness-backend');

// Files/Folders to EXCLUDE
const EXCLUSIONS = [
    'node_modules',
    '.git',
    '.env',
    'logs',
    'tmp',
    'tests',
    'Client-Delivery',
    'prepare_client_delivery.js',
    'check_env.js',
    'create-test-member.js',
    'create-test-payment.js',
    'reset-admin.js',
    'reset-data.js',
    'wipe_all.js',
    'rebrand.js',
    'debug_log.txt',
    'error.log',
    'crash.log',
    'server_crash.txt',
    'server_debug.log',
    'push_log.txt',
    'route_test.log',
    'seeder_error.log',
    'seeder_error.txt',
    'filtered_error.txt',
    'test_results.json',
    'test_results_all.json',
    'Mother-Fitness-Walkthrough.html',
    'mother-Fitness-Complete-Guide.html',
    'COMPLETE_DOCUMENTATION.md' // Maybe too internal? Keeping READMEs.
];

// Helper to check exclusions
function isExcluded(name) {
    if (EXCLUSIONS.includes(name)) return true;
    if (name.startsWith('PHASE') && name.endsWith('_COMPLETE.md')) return true; // Exclude my dev phase artifacts
    return false;
}

function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
    }

    fs.readdirSync(from).forEach(element => {
        if (isExcluded(element)) return;

        const stat = fs.lstatSync(path.join(from, element));
        const dest = path.join(to, element);

        if (stat.isFile()) {
            fs.copyFileSync(path.join(from, element), dest);
        } else if (stat.isDirectory()) {
            copyFolderSync(path.join(from, element), dest);
        }
    });
}

console.log('📦 Starting Client Delivery Packaging...');
console.log(`Source: ${sourceDir}`);
console.log(`Target: ${targetDir}`);

try {
    // Clear previous build
    if (fs.existsSync(targetDir)) {
        console.log('Cleaning previous build...');
        fs.rmSync(targetDir, { recursive: true, force: true });
    }

    copyFolderSync(sourceDir, targetDir);

    // Copy CLIENT_README.md to README.md in the target to be the main readme
    fs.copyFileSync(
        path.join(sourceDir, 'CLIENT_README.md'),
        path.join(targetDir, 'README.md')
    );

    console.log('✅ Packaging Complete!');
    console.log(`📂 Files are ready in: ${targetDir}`);
    console.log('⚠️  REMINDER: Check the folder manually to ensure no personal data slipped through.');

} catch (err) {
    console.error('❌ Packaging Failed:', err);
}
