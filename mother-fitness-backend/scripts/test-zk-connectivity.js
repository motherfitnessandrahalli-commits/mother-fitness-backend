const ZKLib = require('zklib');
const net = require('net');

async function testConnection() {
    // Get IP from command line args
    const ip = process.argv[2];
    const port = parseInt(process.argv[3]) || 4370;

    if (!ip) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Error: Please provide an IP address.');
        console.log('Usage: node scripts/test-zk-connectivity.js <IP_ADDRESS> [PORT]');
        console.log('Example: node scripts/test-zk-connectivity.js 192.168.1.201');
        process.exit(1);
    }

    console.log('\x1b[36m%s\x1b[0m', `🔍 Starting diagnostics for ${ip}:${port}...`);

    // 1. IP Validation
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipRegex.test(ip)) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Invalid IP address format.');
        process.exit(1);
    }
    console.log('✅ IP format valid.');

    // 2. Network Reachability (Socket Connect)
    console.log('📡 Testing network reachability (TCP handshake)...');
    try {
        await new Promise((resolve, reject) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
                socket.destroy();
                reject(new Error('Network timeout - host unreachable'));
            }, 3000);

            socket.connect(port, ip, () => {
                clearTimeout(timeout);
                socket.destroy();
                resolve();
            });

            socket.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
        console.log('✅ Network reachable. Device is online and listening on port ' + port);
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `❌ Network Check Failed: ${error.message}`);
        console.log('   Suggestions:');
        console.log('   - Check if the device is powered on');
        console.log('   - Check if your computer is on the same network (Wi-Fi/LAN)');
        console.log('   - Try pinging the IP from command prompt: ping ' + ip);
        process.exit(1);
    }

    // 3. ZKTeco Protocol Handshake
    console.log('🤝 Testing ZKTeco protocol handshake...');
    const zkInstance = new ZKLib({
        ip,
        port,
        timeout: 5000,
        inport: 5200
    });

    try {
        // Attempt connection
        await zkInstance.createSocket();
        console.log('✅ ZKTeco Socket Created.');

        try {
            const info = await zkInstance.getInfo();
            console.log('\x1b[32m%s\x1b[0m', '🎉 SUCCESS! Device Connected and Responsive.');
            console.log('📱 Device Information:');
            console.log(info);
        } catch (infoError) {
            console.warn('\x1b[33m%s\x1b[0m', '⚠️ Connection partially successful, but failed to get device info.');
            console.warn(`   Error: ${infoError.message}`);
        }

        // Clean disconnect
        await zkInstance.disconnect();
        console.log('🔌 Disconnected.');

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `❌ ZKTeco Protocol Error: ${error.message}`);
        console.log('   It seems the device is reachable but rejected the ZK protocol connection.');
        console.log('   Suggestions:');
        console.log('   - Verify the "Comm Key" on the device is 0 (default)');
        console.log('   - Ensure no other software is currently connected to it');
    }
}

testConnection();
