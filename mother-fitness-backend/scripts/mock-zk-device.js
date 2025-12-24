const net = require('net');

// ZKTeco UDP/TCP Command Constants (Simplified for handshake)
const COMMANDS = {
    CONNECT: 1000,
    EXIT: 1001,
    ENABLE_DEVICE: 1002,
    DISABLE_DEVICE: 1003
};

const PORT = 4370;
const HOST = '127.0.0.1'; // Localhost

const server = net.createServer((socket) => {
    console.log(`\n🔌 Client connected from: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', (data) => {
        console.log(`📥 Received ${data.length} bytes`);

        // Simple TCP Handshake Response (Mimicking ZK)
        // Check for specific ZK packet headers if needed, but for now, 
        // we just acknowledge any data to simulate a "live" device.

        // ZK Response Wrapper (Simplified)
        // Just sending back a valid-looking packet structure so the library doesn't timeout immediately
        const reply = Buffer.alloc(8 + data.length);
        reply.write("P", 0); // Header (arbitrary for mock)

        // In a real scenario, we'd decode the ZK protocol. 
        // For currently testing "Network Reachability", just accepting the socket is enough.
        // But to pass the "handshake", we might need to be smarter.

        // Actually, zklib often requires a specific response. 
        // Since implementing the full protocol is complex, this mock mainly proves
        // "TCP Connection Established".

    });

    socket.on('close', () => {
        console.log('🔌 Client disconnected');
    });

    socket.on('error', (err) => {
        console.error(`❌ Socket error: ${err.message}`);
    });
});

server.listen(PORT, HOST, () => {
    console.log(`\n✅ Mock ZKTeco Device is running!`);
    console.log(`👉 Listening on ${HOST}:${PORT}`);
    console.log(`\nYou can now run the test script in another terminal:`);
    console.log(`   node scripts/test-zk-connectivity.js 127.0.0.1`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('❌ Port 4370 is already in use!');
        console.error('   Is the real software or another simulator already running?');
    } else {
        console.error(`❌ Server error: ${err.message}`);
    }
});
