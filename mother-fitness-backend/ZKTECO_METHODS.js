// Add these methods to the GymApp class in app.js

// ==============================================
// ZKTeco Device Management Methods
// ==============================================

toggleDeviceSettings() {
    const dashboard = document.getElementById('device-settings-dashboard');
    const mainContent = document.querySelector('.dashboard-stats');
    const searchBox = document.querySelector('.controls-section');
    const customerList = document.querySelector('.customer-list-section');
    const analytics = document.getElementById('analytics-dashboard');
    const attendance = document.getElementById('attendance-dashboard');
    const intelligence = document.getElementById('intelligence-dashboard');

    if (dashboard.style.display === 'none' || !dashboard.style.display) {
        // Hide everything else
        mainContent.style.display = 'none';
        searchBox.style.display = 'none';
        customerList.style.display = 'none';
        if (analytics) analytics.style.display = 'none';
        if (attendance) attendance.style.display = 'none';
        if (intelligence) intelligence.style.display = 'none';

        dashboard.style.display = 'block';
        this.loadDeviceStatus();
        this.currentView = 'device-settings';
    } else {
        // Show main view
        mainContent.style.display = 'grid';
        searchBox.style.display = 'flex';
        customerList.style.display = 'block';
        dashboard.style.display = 'none';
        this.currentView = 'list';
    }
}

async connectDevice() {
    const ip = document.getElementById('device-ip').value.trim();
    const port = parseInt(document.getElementById('device-port').value) || 4370;

    if (!ip) {
        this.showNotification('error', 'Validation Error', 'Please enter device IP address');
        return;
    }

    try {
        this.setLoading(true);
        const response = await this.api.request('/api/zkteco/connect', {
            method: 'POST',
            body: JSON.stringify({ ip, port })
        });

        this.deviceConnected = true;
        this.updateConnectionStatus(true, ip, port);
        this.showNotification('success', 'Device Connected', `Successfully connected to ${ip}:${port}`);
        this.logActivity(`Connected to device at ${ip}:${port}`);

        // Enable buttons
        document.getElementById('sync-all-members-btn').disabled = false;
        document.getElementById('refresh-enrolled-btn').disabled = false;

        // Load stats
        await this.loadDeviceStatus();
    } catch (error) {
        this.deviceConnected = false;
        this.updateConnectionStatus(false);
        this.showNotification('error', 'Connection Failed', error.message);
        this.logActivity(`Connection failed: ${error.message}`, 'error');
    } finally {
        this.setLoading(false);
    }
}

async disconnectDevice() {
    try {
        this.setLoading(true);
        await this.api.request('/api/zkteco/disconnect', { method: 'POST' });

        this.deviceConnected = false;
        this.updateConnectionStatus(false);
        this.showNotification('info', 'Device Disconnected', 'Successfully disconnected from device');
        this.logActivity('Disconnected from device');

        // Disable buttons
        document.getElementById('sync-all-members-btn').disabled = true;
        document.getElementById('refresh-enrolled-btn').disabled = true;
    } catch (error) {
        this.showNotification('error', 'Disconnect Failed', error.message);
    } finally {
        this.setLoading(false);
    }
}

async loadDeviceStatus() {
    try {
        const response = await this.api.request('/api/zkteco/status');
        const { connected, ip, port, deviceInfo } = response.data;

        if (connected) {
            this.updateDeviceInfo(ip, port, deviceInfo);
        }
    } catch (error) {
        console.error('Failed to load device status:', error);
    }
}

updateConnectionStatus(connected, ip = '', port = '') {
    const banner = document.getElementById('connection-status-banner');
    const statusText = document.getElementById('status-text');
    const connect Btn = document.getElementById('connect-device-btn');
    const disconnectBtn = document.getElementById('disconnect-device-btn');

    if (connected) {
        banner.className = 'connection-status connected';
        statusText.textContent = `Connected to ${ip}:${port}`;
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-block';
    } else {
        banner.className = 'connection-status disconnected';
        statusText.textContent = 'Not Connected';
        connectBtn.style.display = 'inline-block';
        disconnectBtn.style.display = 'none';
    }
}

updateDeviceInfo(ip, port, deviceInfo) {
    document.getElementById('info-status').textContent = 'Connected';
    document.getElementById('info-ip').textContent = ip || '-';
    document.getElementById('info-port').textContent = port || '-';
    document.getElementById('info-users').textContent = deviceInfo?.enrolledUsers || '-';
}

async syncAllMembers() {
    const confirmSync = confirm('This will enroll all active members to the device. Continue?');
    if (!confirmSync) return;

    try {
        this.setLoading(true);
        const statusDiv = document.getElementById('enrollment-status');
        const progress = document.getElementById('enrollment-progress');
        const message = document.getElementById('enrollment-message');

        statusDiv.style.display = 'block';
        progress.style.width = '0%';
        message.textContent = 'Starting enrollment...';

        const response = await this.api.request('/api/zkteco/sync-all-members', {
            method: 'POST'
        });

        const { success, failed } = response.data;

        progress.style.width = '100%';
        message.textContent = `✅ Synced ${success} members successfully. ${failed > 0 ? `${failed} failed.` : ''}`;

        this.showNotification('success', 'Sync Complete', `Enrolled ${success} members to device`);
        this.logActivity(`Synced ${success} members to device`);

        // Update stats
        await this.refreshEnrolledUsers();
    } catch (error) {
        document.getElementById('enrollment-message').textContent = `❌ Sync failed: ${error.message}`;
        this.showNotification('error', 'Sync Failed', error.message);
    } finally {
        this.setLoading(false);
    }
}

async refreshEnrolledUsers() {
    try {
        const response = await this.api.request('/api/zkteco/enrolled-users');
        const { count } = response.data;

        document.getElementById('enrolled-members-stat').textContent = count || 0;
        document.getElementById('total-members-stat').textContent = this.customers.filter(c => c.getStatus() !== 'expired').length;

        this.logActivity(`Refreshed enrollment status: ${count} enrolled`);
    } catch (error) {
        console.error('Failed to refresh enrolled users:', error);
    }
}

logActivity(message, type = 'info') {
    const logContainer = document.getElementById('device-activity-log');
    const timestamp = new Date().toLocaleTimeString();

    const entry = document.createElement('div');
    entry.className = `activity-entry ${type}`;
    entry.innerHTML = `
        <span class="activity-time">${timestamp}</span>
        <span class="activity-message">${message}</span>
    `;

    // Remove empty text if it exists
    const emptyText = logContainer.querySelector('.empty-text');
    if (emptyText) emptyText.remove();

    logContainer.insertBefore(entry, logContainer.firstChild);

    // Keep only last 50 entries
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

// Setup Socket.IO listeners for real-time events
setupSocketListeners() {
    if (!this.socket) {
        this.socket = io();
    }

    // ZKTeco attendance events
    this.socket.on('zkteco:attendance', (data) => {
        const { customer, timestamp, alreadyMarked } = data;

        // Show notification
        if (!alreadyMarked) {
            this.showNotification(
                'success',
                '✅ Check-in Recorded',
                `${customer.name} checked in at ${new Date(timestamp).toLocaleTimeString()}`
            );

            // Log activity
            this.logActivity(`${customer.name} checked in`);

            // Refresh attendance if on attendance view
            if (this.currentView === 'attendance') {
                this.renderAttendance();
            }
        }
    });

    // Device status updates
    this.socket.on('zkteco:status', (data) => {
        console.log('Device status update:', data);
        this.loadDeviceStatus();
    });

    // Error notifications
    this.socket.on('zkteco:error', (data) => {
        this.showNotification('error', 'Device Error', data.message);
        this.logActivity(`Error: ${data.message}`, 'error');
    });
}
