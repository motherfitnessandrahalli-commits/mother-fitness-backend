// ===================================
// Mother Fitness - Application Logic
// ===================================

// Customer Data Model
class Customer {
    constructor(id, name, age, email, phone, plan, validity, notes = '', photo = '', createdAt = new Date(), memberId = '', balance = 0) {
        this.id = id;
        this.name = name;
        this.age = age;
        this.email = email;
        this.phone = phone;
        this.plan = plan;
        this.validity = validity;
        this.notes = notes;
        this.photo = photo;
        this.createdAt = createdAt;
        this.memberId = memberId;
        this.balance = balance;
    }

    getStatus() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const validityDate = new Date(this.validity);
        validityDate.setHours(0, 0, 0, 0);

        const diffTime = validityDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return 'expired';
        } else if (diffDays <= 7) {
            return 'expiring';
        } else {
            return 'active';
        }
    }

    getDaysRemaining() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const validityDate = new Date(this.validity);
        validityDate.setHours(0, 0, 0, 0);

        const diffTime = validityDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}

// Application State
// ===================================
// Access Result Manager (UI Feedback)
// ===================================

class AccessResultManager {
    constructor(app) {
        this.app = app;
        this.isListening = true;
        this.overlayContainer = null;
        this.init();
    }

    init() {
        // Create overlay container if not exists
        if (!document.getElementById('access-result-overlay')) {
            const container = document.createElement('div');
            container.id = 'access-result-overlay';
            container.className = 'access-result-overlay';
            document.body.appendChild(container);
            this.overlayContainer = container;
        } else {
            this.overlayContainer = document.getElementById('access-result-overlay');
        }
    }

    start() { this.isListening = true; }
    stop() { this.isListening = false; }

    showResult(data) {
        if (!this.isListening) return;

        const { success, message, customer, type, deviceRole } = data;
        const resultType = success ? 'granted' : 'denied';

        // Create access card
        const card = document.createElement('div');
        card.className = `access-card ${resultType}`;

        const photoHtml = customer && customer.photo
            ? `<img src="${customer.photo}" class="access-avatar" alt="Member">`
            : `<div class="access-avatar" style="background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; font-size: 3rem;">👤</div>`;

        card.innerHTML = `
            <div class="access-indicator ${resultType}">
                ${success ? '✅' : '❌'} ${deviceRole || 'ENTRY'}
            </div>
            ${photoHtml}
            <div class="access-title">${success ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</div>
            <div class="access-name">${customer ? customer.name : 'Unknown'}</div>
            <div class="access-msg">${message || (success ? 'Welcome to Mother Fitness!' : 'Access Blocked')}</div>
            <div class="access-time">${new Date().toLocaleTimeString()}</div>
        `;

        this.overlayContainer.prepend(card);

        // Voice Alert
        if (message) {
            this.app.playVoiceAlert(message);
        } else if (success) {
            this.app.playVoiceAlert(`Welcome ${customer ? customer.name : ''}`);
        }

        // Sound Feedback
        this.app.playBeep(success ? 'short' : 'long');

        // Auto-remove card
        setTimeout(() => {
            card.style.animation = 'slideInRight 0.3s reverse forwards';
            setTimeout(() => card.remove(), 300);
        }, 5000);
    }

    // For backward compatibility with existing calls
    setUIState(type, customer, message) {
        this.showResult({
            success: type === 'granted',
            customer,
            message,
            deviceRole: 'SCAN'
        });
    }

    resetUI() { /* No-op, managed by auto-remove */ }
}

class GymApp {
    constructor() {
        this.customers = [];
        this.currentFilter = 'all';
        this.currentSort = 'name';
        this.searchQuery = '';
        this.editingCustomerId = null;
        this.deleteCustomerId = null;
        this.currentTheme = 'dark';
        this.currentPhoto = '';
        this.viewingPhotoCustomerId = null;
        this.cameraStream = null;
        this.cameraActive = false;
        this.charts = {}; // Store chart instances
        this.currentView = 'list'; // 'list' or 'analytics'
        this.payments = []; // Initialize payments array
        this.api = new API(); // Initialize api
        this.isAuthenticated = false;

        // Socket.IO for real-time events
        this.socket = null;
        this.deviceConnected = false;
        this.connectedDevices = []; // Track multiple ZKTeco devices

        // Initialize Access UI Manager
        this.biometricSystem = new AccessResultManager(this);

        this.init();
    }

    async init() {
        // Clear any existing session token to force login on every page load
        sessionStorage.removeItem('token');
        this.api.token = null;
        this.isAuthenticated = false;

        // Initialize Notification Store
        this.notifications = [];
        this.injectNotificationCenter();

        // Always show login screen on page load
        this.setupLoginListeners();
        document.getElementById('login-overlay').classList.remove('hidden');
    }
    checkAuth() {
        return this.api.isAuthenticated();
    }

    // Initialize app after successful login
    async initializeApp() {
        try {
            this.loadTheme();
            await this.loadCustomers();
            this.setupEventListeners();
            this.checkExpiringPlans();
            this.render();
            this.initSocket(); // Initialize socket first with correct URL
            this.setupSocketListeners(); // Then setup listeners

            // Load Initial ZKTeco & Occupancy Data
            this.loadZKTecoStatus();
            this.updateOccupancy();

            // Periodic Occupancy Refresh (Every 30s as fallback to Socket)
            setInterval(() => this.updateOccupancy(), 30000);
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showNotification('error', 'Error', `Failed to load application: ${error.message}`);
        }
    }

    initSocket() {
        if (this.socket) return;

        const token = this.api.token;
        if (!token) return;

        if (typeof io === 'undefined') {
            console.error('Socket.io (io) is not defined. Features requiring real-time updates will not work.');
            this.showNotification('warning', 'Connection Warning', 'Real-time updates may be unavailable.');
            return;
        }

        this.socket = io(this.api.baseURL, {
            query: { token }
        });

        this.socket.on('connect', () => {
            console.log('Connected to backend sockets');
        });

        // Unified Access Result Listener (IN/OUT)
        this.socket.on('access:result', (data) => {
            console.log('Access Result Received via Socket:', data);
            // TRIGGER THE ACTUAL UI (Link 4)
            console.log('🎬 TRIGGERING MAIN UI RENDERING...');
            this.biometricSystem.showResult(data);

            // Testing confirmation as requested
            alert("ACCESS " + (data.decision || 'GRANTED'));

            // Explicitly update diagnosis status if element exists
            const statusBox = document.getElementById('scan-status');
            if (statusBox) {
                const isAllowed = data.status === 'allowed' || data.success === true;
                statusBox.textContent = isAllowed ? '✅ ACCESS GRANTED (SOCKET)' : '❌ ACCESS DENIED (SOCKET)';
                statusBox.style.background = isAllowed ? '#059669' : '#dc2626';
            }

            // Update stats & occupancy
            this.updateAttendanceStats();
            this.updateOccupancy();

            // Refresh list if dashboard is open
            if (this.currentView === 'attendance') {
                this.renderAttendance();
            }
        });

        // Diagnostic Pong Listener
        this.socket.on('test-pong', (data) => {
            console.log('🏓 Socket Pong Received:', data);
            this.showNotification('info', 'Socket Active', 'Link verified with backend');
            const statusBox = document.getElementById('scan-status');
            if (statusBox) {
                statusBox.textContent = '🏓 SOCKET LINK ACTIVE (PONG)';
                statusBox.style.background = '#3b82f6';

                // Reset after 3 seconds
                setTimeout(() => {
                    statusBox.textContent = 'READY TO SCAN';
                    statusBox.style.background = '#334155';
                }, 3000);
            }
        });

        // Legacy listeners (fallback)
        this.socket.on('access:granted', (data) => {
            if (!data.processed) { // Avoid double handling if result was already sent
                this.biometricSystem.setUIState('granted', data.customer);
                this.updateAttendanceStats();
            }
        });

        this.socket.on('access:denied', (data) => {
            if (!data.processed) {
                this.biometricSystem.setUIState('denied', data.customer, data.message);
            }
        });
    }

    // ===================================
    // View Management & Dashboards
    // ===================================

    switchView(viewId) {
        const dashboards = [
            'intelligence-dashboard',
            'device-settings-dashboard',
            'access-dashboard',
            'attendance-dashboard',
            'analytics-dashboard'
        ];

        const mainContent = [
            '.dashboard-stats',
            '.controls-section',
            '.customer-list-section'
        ];

        console.log(`Switching view to: ${viewId}`);

        // Hide all dashboards
        dashboards.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        if (viewId === 'list') {
            // Show main dashboard elements
            document.querySelector('.dashboard-stats').style.display = 'grid';
            document.querySelector('.controls-section').style.display = 'flex';
            document.querySelector('.customer-list-section').style.display = 'block';
            this.currentView = 'list';
        } else {
            // Hide main dashboard elements
            mainContent.forEach(sel => {
                const el = document.querySelector(sel);
                if (el) el.style.display = 'none';
            });

            // Show target dashboard
            const target = document.getElementById(viewId);
            if (target) {
                target.style.display = 'block';
                this.currentView = viewId;

                // Secondary actions based on view
                if (viewId === 'intelligence-dashboard') this.loadIntelligenceData();
                if (viewId === 'device-settings-dashboard') {
                    this.loadZKTecoStatus();
                    this.updateOccupancy();
                }
                if (viewId === 'attendance-dashboard') this.renderAttendance();
                if (viewId === 'analytics-dashboard') this.loadProfitMetrics();
            }
        }
    }

    // --- DEBUGGING METHODS FOR BIOMETRIC SCAN ---
    async triggerBiometricMock(memberId, direction) {
        console.log(`🚀 TRIGGERING MOCK: ${memberId} ${direction}`);
        const statusBox = document.getElementById('scan-status');
        if (statusBox) {
            statusBox.textContent = '⏳ Calling API...';
            statusBox.style.background = '#334155';
        }

        try {
            // SIMULATING REAL H5L HARDWARE PAYLOAD
            const realHardwarePayload = {
                device_id: "H5L_GATE_01",
                user_id: memberId,
                verify_type: "FACE",
                timestamp: new Date().toISOString().replace('T', ' ').split('.')[0],
                direction: direction
            };

            const response = await this.api.request('/api/biometric/mock', {
                method: 'POST',
                body: JSON.stringify(realHardwarePayload)
            });

            const data = response.data || response; // API class might return data or the whole response
            console.log('📥 RESPONSE FROM BACKEND:', data);

            if (statusBox) {
                if (data.decision === 'ALLOW') {
                    statusBox.textContent = '✅ ACCESS GRANTED (API CALLBACK)';
                    statusBox.style.background = '#059669';
                } else {
                    statusBox.textContent = `❌ ACCESS DENIED: ${data.decision || 'REJECTED'}`;
                    statusBox.style.background = '#dc2626';
                }
            }

            // TRIGGER THE ACTUAL UI (Ensures Link 4 is tested)
            this.biometricSystem.showResult(data);

            // Testing confirmation as requested
            alert("ACCESS " + (data.decision || 'ALLOW'));
        } catch (error) {
            console.error('❌ MOCK ERROR:', error);
            if (statusBox) {
                statusBox.textContent = `❌ ERROR: ${error.message}`;
                statusBox.style.background = '#dc2626';
            }
        }
    }

    testSocketLink() {
        console.log('📡 SENDING SOCKET PING...');
        if (!this.socket || !this.socket.connected) {
            alert('Socket not connected! Status: ' + (this.socket ? 'DISCONNECTED' : 'UNDEFINED'));
            return;
        }
        this.socket.emit('test-ping', 'ping-' + Date.now());
    }

    testManualUI() {
        console.log('🧪 TESTING MANUAL UI UPDATE');
        const statusBox = document.getElementById('scan-status');
        if (statusBox) {
            statusBox.textContent = '✅ ACCESS GRANTED (LOCAL TEST)';
            statusBox.style.background = '#059669';
            this.showNotification('success', 'UI Test', 'Local status box updated correctly');
        } else {
            alert('Element #scan-status not found! Are you on the Access Monitoring view?');
        }
    }
    handleAlertAction(memberId, issue) {
        console.log(`Action triggered for ${memberId}: ${issue}`);

        // Find existing customer
        const customer = this.customers.find(c => c.memberId === memberId);

        if (issue === 'Revenue Leakage' || issue === 'Attendance Drop') {
            // Open customer modal to take direct action
            if (customer) {
                this.openCustomerModal(customer.id);
            } else {
                this.showNotification('info', 'Member Details', `Action for ${memberId}: ${issue}. Member details not pre-loaded.`);
            }
        } else {
            this.showNotification('info', 'Intelligent Action', `Recommended: ${issue} for ${memberId}.`);
        }
    }
    // ------------------------------------------

    toggleIntelligenceView() {
        this.toggleView('intelligence');
    }

    async syncAllMembers() {
        if (!this.deviceConnected) {
            this.showNotification('error', 'Device Required', 'Please connect at least one biometric device before syncing.');
            this.toggleView('device-settings');
            return;
        }

        const confirmSync = confirm('This will enroll all active members to the device. Continue?');
        if (!confirmSync) return;

        try {
            this.setLoading(true);
            const statusDiv = document.getElementById('enrollment-status');
            const progress = document.getElementById('enrollment-progress');
            const message = document.getElementById('enrollment-message');

            if (statusDiv) statusDiv.style.display = 'block';
            if (progress) progress.style.width = '20%';
            if (message) message.textContent = 'Contacting device...';

            const response = await this.api.syncZKTeco();

            const { success, failed } = response.data || { success: 0, failed: 0 };

            if (progress) progress.style.width = '100%';
            if (message) message.textContent = `✅ Synced ${success} members successfully. ${failed > 0 ? `${failed} failed.` : ''}`;

            this.showNotification('success', 'Sync Complete', `Enrolled ${success} members to device`);

            // Update stats
            await this.loadZKTecoStatus();
        } catch (error) {
            console.error('Sync failed:', error);
            this.showNotification('error', 'Sync Failed', error.message || 'Could not sync members to device');
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
        if (!logContainer) return;

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

    setupSocketListeners() {
        if (!this.socket) {
            console.warn('Socket not initialized. Waiting for initSocket...');
            return;
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


    async loadIntelligenceData() {
        try {
            const response = await this.api.getBusinessHealth();

            // Handle different possible response structures
            let health = null;
            let risks = null;

            if (response && response.data) {
                health = response.data.health;
                risks = response.data.risks;
            } else if (response) {
                health = response.health;
                risks = response.risks;
            }

            // Update Health Score
            const circle = document.getElementById('health-score-circle');
            const valText = document.getElementById('health-score-val');
            const statusText = document.getElementById('health-status');

            if (circle && valText && statusText && health && typeof health.score !== 'undefined') {
                const score = health.score;
                circle.style.strokeDasharray = `${score}, 100`;
                valText.textContent = `${score}%`;
                statusText.textContent = health.status || 'Unknown';

                // Color coding
                if (score < 40) statusText.style.color = 'var(--danger-color)';
                else if (score < 60) statusText.style.color = 'var(--warning-color)';
                else statusText.style.color = 'var(--success-color)';
            } else if (statusText) {
                statusText.textContent = 'No data available';
                statusText.style.color = 'var(--text-secondary)';
            }

            // Update Churn Risk & Leakage Counts
            const churnCount = document.getElementById('churn-count');
            const leakageCount = document.getElementById('leakage-count');

            if (churnCount && risks) churnCount.textContent = risks.churnCount || '0';
            if (leakageCount && risks) leakageCount.textContent = risks.leakageCount || '0';

            // Update Attention List Table
            const attentionListBody = document.getElementById('attention-list-body');
            const attentionList = response.data ? response.data.attentionList : (response.attentionList || []);

            if (attentionListBody) {
                if (!attentionList || attentionList.length === 0) {
                    attentionListBody.innerHTML = `
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
                                No urgent issues detected. Gym is healthy! ✅
                            </td>
                        </tr>
                    `;
                } else {
                    attentionListBody.innerHTML = attentionList.map(item => `
                        <tr>
                            <td>
                                <div class="member-cell">
                                    <div class="member-name">${item.name}</div>
                                    <div class="member-id">${item.memberId}</div>
                                </div>
                            </td>
                            <td><span class="issue-tag">${item.issue}</span></td>
                            <td class="detail-cell">${item.detail}</td>
                            <td><span class="severity-badge ${item.severity.toLowerCase()}">${item.severity}</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="app.handleAlertAction('${item.memberId}', '${item.issue}')">
                                    ${item.action}
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            }

        } catch (error) {
            console.error('Failed to load intelligence data:', error);
            this.showNotification('error', 'Intelligence Error', 'Could not load gym health metrics.');
        }
    }

    async loadProfitMetrics() {
        try {
            const response = await this.api.request('/api/analytics/profits');
            const profits = response.data || response;

            // Update profit displays
            const dailyEl = document.getElementById('daily-profit');
            const weeklyEl = document.getElementById('weekly-profit');
            const monthlyEl = document.getElementById('monthly-profit');
            const yearlyEl = document.getElementById('yearly-profit');

            if (dailyEl && profits.daily !== undefined) {
                dailyEl.textContent = `₹${profits.daily.toLocaleString('en-IN')}`;
            }
            if (weeklyEl && profits.weekly !== undefined) {
                weeklyEl.textContent = `₹${profits.weekly.toLocaleString('en-IN')}`;
            }
            if (monthlyEl && profits.monthly !== undefined) {
                monthlyEl.textContent = `₹${profits.monthly.toLocaleString('en-IN')}`;
            }
            if (yearlyEl && profits.yearly !== undefined) {
                yearlyEl.textContent = `₹${profits.yearly.toLocaleString('en-IN')}`;
            }
        } catch (error) {
            console.error('Failed to load profit metrics:', error);
            this.showNotification('error', 'Analytics Error', 'Could not load revenue data.');
        }
    }

    showCustomerTab(tab) {
        const profileBtn = document.getElementById('profile-tab-btn');
        const timelineBtn = document.getElementById('timeline-tab-btn');
        const profileContent = document.getElementById('customer-profile-content');
        const timelineContent = document.getElementById('customer-timeline-content');

        if (tab === 'profile') {
            profileBtn.classList.add('active');
            timelineBtn.classList.remove('active');
            profileContent.style.display = 'block';
            timelineContent.style.display = 'none';
        } else {
            profileBtn.classList.remove('active');
            timelineBtn.classList.add('active');
            profileContent.style.display = 'none';
            timelineContent.style.display = 'block';
            if (this.editingCustomerId) {
                this.loadMemberTimeline(this.editingCustomerId);
            }
        }
    }

    async loadMemberTimeline(customerId) {
        const timelineList = document.getElementById('member-timeline');
        timelineList.innerHTML = '<p class="loading-text">Loading journey...</p>';

        try {
            const response = await this.api.getMemberTimeline(customerId);

            // Handle different possible response structures
            let events = null;
            if (response && response.data && response.data.timeline) {
                events = response.data.timeline;
            } else if (response && response.timeline) {
                events = response.timeline;
            } else if (response && Array.isArray(response.data)) {
                events = response.data;
            } else if (response && Array.isArray(response)) {
                events = response;
            }

            // Check if events is valid and has items
            if (!events || !Array.isArray(events) || events.length === 0) {
                timelineList.innerHTML = '<p class="empty-text">No history recorded yet.</p>';
                return;
            }

            timelineList.innerHTML = events.map(event => `
                <div class="timeline-item ${event.type ? event.type.toLowerCase() : 'default'}">
                    <div class="timeline-marker"></div>
                    <div class="timeline-content">
                        <div class="time">${event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Unknown time'}</div>
                        <div class="title">${event.title || 'Event'}</div>
                        <div class="details">${event.details || ''}</div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load timeline:', error);
            timelineList.innerHTML = '<p class="error-text">Failed to load journey history.</p>';
        }
    }

    setupAnalyticsListener() {
        // Explicitly handle analytics button to prevent double-click issues
        setTimeout(() => {
            const btn = document.getElementById('menu-analytics-btn');
            if (btn) {
                // Remove existing listeners by cloning
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);

                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Force toggle based on current state
                    if (this.currentView === 'analytics') {
                        this.toggleView('list');
                    } else {
                        this.toggleView('analytics');
                    }

                    this.closeHamburgerMenu();
                });
            }
        }, 1500); // Wait for DOM
    }

    checkExpiringPlans() {
        const expiringCustomers = this.customers.filter(c => c.getStatus() === 'expiring');
        if (expiringCustomers.length > 0) {
            // Optional: Show a notification on load if there are expiring plans
            // this.showNotification('warning', 'Expiring Plans', `${expiringCustomers.length} customers have plans expiring soon.`);
        }
    }

    async notifyExpiredCustomers() {
        // Redirect to the new implementation which uses the backend API
        // This duplicate method is removed to avoid confusion.
        // utilization of this.notifyExpiredCustomers() at line 597
        return this.notifyExpiredCustomersImpl(); // Forwarder if needed, or just delete.
    }

    // Helper function to get local date string (YYYY-MM-DD) in user's timezone
    getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    setLoading(isLoading) {
        const loader = document.getElementById('global-loader');
        if (isLoading) {
            if (!loader) {
                const loaderEl = document.createElement('div');
                loaderEl.id = 'global-loader';
                loaderEl.className = 'global-loader';
                // CSS Loader replacement for broken Lottie
                loaderEl.innerHTML = `
                <div class="spinner-container">
                    <div class="spinner"></div>
                    <style>
                        .spinner-container { display: flex; justify-content: center; align-items: center; }
                        .spinner {
                            width: 60px;
                            height: 60px;
                            border: 5px solid rgba(255, 255, 255, 0.1);
                            border-radius: 50%;
                            border-top-color: #4ECDC4;
                            animation: spin 1s ease-in-out infinite;
                        }
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    </style>
                </div>
            `;
                loaderEl.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(5px); z-index: 9999; display: flex; justify-content: center; align-items: center;';
                document.body.appendChild(loaderEl);
            } else {
                loader.style.display = 'flex';
            }
        } else {
            if (loader) loader.style.display = 'none';
        }
    }

    animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    playPageTransition(oldViewId, newViewId) {
        const oldView = document.getElementById(oldViewId);
        const newView = document.getElementById(newViewId);

        if (oldView) {
            oldView.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => {
                oldView.style.display = 'none';
                if (newView) {
                    newView.style.display = 'block';
                    newView.style.animation = 'fadeIn 0.3s ease-out forwards';
                }
            }, 300);
        } else if (newView) {
            newView.style.display = 'block';
            newView.style.animation = 'fadeIn 0.3s ease-out forwards';
        }
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        try {
            this.setLoading(true);
            await this.api.login(email, password);
            this.isAuthenticated = true;
            document.getElementById('login-overlay').classList.add('hidden');
            errorEl.style.display = 'none';

            // Initialize the app (don't call init() as it clears the token)
            await this.initializeApp();
        } catch (error) {
            errorEl.textContent = error.message || 'Invalid credentials';
            errorEl.style.display = 'block';
            document.getElementById('login-password').value = '';
        } finally {
            this.setLoading(false);
        }
    }
    setupLoginListeners() {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
    }



    openPasswordModal() {
        document.getElementById('password-modal').classList.add('show');
    }

    closePasswordModal() {
        document.getElementById('password-modal').classList.remove('show');
        document.getElementById('password-form').reset();
    }

    handleLogout() {
        this.api.logout();
        sessionStorage.removeItem('motherFitnessAuth');
        window.location.reload();
    }

    async handlePasswordChange(currentPwd, newPwd, confirmPwd) {
        // Validation
        if (newPwd !== confirmPwd) {
            this.showNotification('error', 'Password Mismatch', 'New passwords do not match.');
            return;
        }

        if (newPwd.length < 6) {
            this.showNotification('error', 'Weak Password', 'Password must be at least 6 characters.');
            return;
        }

        if (currentPwd === newPwd) {
            this.showNotification('error', 'Same Password', 'New password must be different from current password.');
            return;
        }

        try {
            this.setLoading(true);
            await this.api.changePassword(currentPwd, newPwd);
            this.showNotification('success', 'Password Changed', 'Your password has been updated successfully.');
            this.closePasswordModal();
            document.getElementById('password-form').reset();
        } catch (error) {
            console.error('Password change failed:', error);
            // Show specific error message from server
            if (error.message && error.message.includes('current password')) {
                this.showNotification('error', 'Incorrect Password', 'Current password is incorrect.');
            } else {
                this.showNotification('error', 'Change Failed', error.message || 'Could not change password');
            }
        } finally {
            this.setLoading(false);
        }
    }

    // Theme Management
    loadTheme() {
        const savedTheme = localStorage.getItem('motherFitnessTheme');
        if (savedTheme) {
            this.currentTheme = savedTheme;
            if (savedTheme === 'light') {
                document.body.classList.add('light-mode');
                const themeIcon = document.querySelector('#menu-theme-toggle .menu-icon');
                if (themeIcon) themeIcon.textContent = '☀️';
            }
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.body.classList.toggle('light-mode');

        const themeBtn = document.getElementById('menu-theme-toggle');
        if (themeBtn) {
            const icon = themeBtn.querySelector('.menu-icon');
            const text = themeBtn.querySelector('.menu-text');
            icon.textContent = this.currentTheme === 'light' ? '☀️' : '🌙';
            text.textContent = this.currentTheme === 'light' ? 'Light Mode' : 'Dark Mode';
        }

        localStorage.setItem('motherFitnessTheme', this.currentTheme);
        this.showNotification('success', 'Theme Changed', `Switched to ${this.currentTheme} mode`);
    }

    // Local Storage Management
    // Data Management
    // Data Management
    // migrateData and addSampleData are removed as we are using API now


    // Access Control Methods
    async loadPorts() {
        try {
            const response = await this.api.getAccessPorts();
            const select = document.getElementById('access-port-select');
            if (select) {
                select.innerHTML = '<option value="">Select Port</option>';
                response.data.ports.forEach(port => {
                    const opt = document.createElement('option');
                    opt.value = port.path;
                    opt.textContent = `${port.path} (${port.friendlyName || 'Unknown Device'})`;
                    select.appendChild(opt);
                });
            }
        } catch (error) {
            console.error('Failed to load ports:', error);
        }
    }

    async connectHardware() {
        // ... existing serial port logic remains if needed, but we focus on ZKTeco
    }

    // ===================================
    // ZKTeco Multi-Device Management
    // ===================================

    async connectDevice() {
        const ip = document.getElementById('device-ip')?.value;
        const port = parseInt(document.getElementById('device-port')?.value || '4370');
        const role = document.getElementById('device-role')?.value || 'IN';

        if (!ip) {
            this.showNotification('error', 'Required Field', 'Please enter Device IP Address');
            return;
        }

        try {
            this.setLoading(true);
            this.showNotification('warning', 'Connecting...', `Connecting to ${ip} as ${role} device...`);

            const response = await this.api.connectZKTeco(ip, port, role);

            this.showNotification('success', 'Connected', `Successfully connected to device at ${ip}`);

            // Refresh list
            await this.loadZKTecoStatus();

            // Clear inputs
            if (document.getElementById('device-ip')) document.getElementById('device-ip').value = '';
        } catch (error) {
            console.error('ZKTeco connection failed:', error);
            this.showNotification('error', 'Connection Failed', error.message || 'Could not connect to device');
        } finally {
            this.setLoading(false);
        }
    }

    async disconnectDevice(ip) {
        if (!confirm(`Disconnect device ${ip}?`)) return;

        try {
            this.setLoading(true);
            await this.api.disconnectZKTeco(ip);
            this.showNotification('success', 'Disconnected', `Device ${ip} disconnected`);
            await this.loadZKTecoStatus();
        } catch (error) {
            this.showNotification('error', 'Error', 'Failed to disconnect device');
        } finally {
            this.setLoading(false);
        }
    }

    async loadZKTecoStatus() {
        try {
            const response = await this.api.getZKTecoStatus();
            const devices = response?.data?.devices || [];
            this.connectedDevices = devices;
            this.renderConnectedDevices();

            // Update global connection flag (for UI compatibility)
            this.deviceConnected = Array.isArray(devices) && devices.some(d => d && d.isConnected);
            this.updateConnectionBanner();

            // Enable/disable enrollment buttons based on connection status
            const syncAllBtn = document.getElementById('sync-all-members-btn');
            const refreshBtn = document.getElementById('refresh-enrolled-btn');

            if (this.deviceConnected) {
                // At least one device connected - enable buttons
                if (syncAllBtn) syncAllBtn.disabled = false;
                if (refreshBtn) refreshBtn.disabled = false;
            } else {
                // No devices connected - disable buttons
                if (syncAllBtn) syncAllBtn.disabled = true;
                if (refreshBtn) refreshBtn.disabled = true;
            }
        } catch (error) {
            console.error('Failed to load device status:', error);
            this.connectedDevices = [];
            this.renderConnectedDevices();

            // Disable buttons on error
            const syncAllBtn = document.getElementById('sync-all-members-btn');
            const refreshBtn = document.getElementById('refresh-enrolled-btn');
            if (syncAllBtn) syncAllBtn.disabled = true;
            if (refreshBtn) refreshBtn.disabled = true;
        }
    }

    renderConnectedDevices() {
        const container = document.getElementById('connected-devices-list');
        if (!container) return;

        if (!Array.isArray(this.connectedDevices) || this.connectedDevices.length === 0) {
            container.innerHTML = `
                <div class="empty-devices" style="text-align: center; padding: 20px; color: var(--text-muted); background: rgba(0,0,0,0.1); border-radius: 8px;">
                    <p>No devices connected yet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.connectedDevices.map(device => `
            <div class="device-item">
                <div class="device-info-main">
                    <div class="device-icon" style="font-size: 1.5rem;">${device.role === 'IN' ? '📥' : '📤'}</div>
                    <div class="device-details">
                        <h4>${device.ip}:${device.port}</h4>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="device-role-badge role-${device.role.toLowerCase()}">${device.role} DEVICE</span>
                            <span class="device-status-pill ${device.isConnected ? 'status-online' : 'status-offline'}">
                                ${device.isConnected ? '● Online' : '● Offline'}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="device-item-actions">
                    ${device.isConnected ?
                `<button class="btn btn-danger btn-sm" onclick="app.disconnectDevice('${device.ip}')">Disconnect</button>` :
                `<button class="btn btn-primary btn-sm" onclick="app.reconnectDevice('${device.ip}', ${device.port}, '${device.role}')">Reconnect</button>`
            }
                </div>
            </div>
        `).join('');
    }

    updateConnectionBanner() {
        const banner = document.getElementById('connection-status-banner');
        const text = document.getElementById('status-text');
        if (!banner || !text) return;

        if (this.deviceConnected) {
            banner.className = 'connection-status connected';
            const onlineCount = this.connectedDevices.filter(d => d.isConnected).length;
            text.textContent = `${onlineCount} Device(s) Powered ON`;
        } else {
            banner.className = 'connection-status disconnected';
            text.textContent = 'All Devices Offline';
        }
    }

    async reconnectDevice(ip, port, role) {
        // Reuse connectDevice logic or implement specific reconnect
        document.getElementById('device-ip').value = ip;
        document.getElementById('device-port').value = port;
        document.getElementById('device-role').value = role;
        this.connectDevice();
    }

    async syncZKTeco() {
        if (!this.deviceConnected) {
            this.showNotification('error', 'Device Required', 'No devices are currently connected. Please add a device first.');
            return;
        }
        await this.syncAllMembers();
    }

    // ===================================
    // Occupancy & Live Tracking
    // ===================================

    async updateOccupancy() {
        try {
            const response = await this.api.getOccupancy();
            if (!response || !response.data) return;
            const { count, members } = response.data;

            // Update main dashboard widget
            const liveCountEl = document.getElementById('live-gym-count');
            if (liveCountEl) {
                this.animateValue(liveCountEl, parseInt(liveCountEl.textContent) || 0, count, 500);
            }

            // Update inside members list in settings
            this.renderInsideMembers(members);
        } catch (error) {
            console.error('Failed to update occupancy:', error);
        }
    }

    renderInsideMembers(members) {
        const container = document.getElementById('inside-members-list');
        if (!container) return;

        if (!members || members.length === 0) {
            container.innerHTML = '<div class="empty-notif" style="padding: 20px; text-align: center; color: var(--text-muted);">Gym is currently empty</div>';
            return;
        }

        container.innerHTML = members.map(member => `
            <div class="visitor-row">
                ${member.photo ?
                `<img src="${member.photo}" class="visitor-avatar">` :
                `<div class="visitor-avatar">👤</div>`
            }
                <div class="visitor-info">
                    <h5>${this.escapeHtml(member.name)}</h5>
                    <span>In since: ${new Date(member.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        `).join('');
    }

    toggleDeviceSettings() {
        this.toggleView('device-settings');
    }

    toggleAccessView() {
        this.toggleView('access');
    }

    setupAccessListener() {
        // Explicitly handle access control button to prevent double-click issues
        setTimeout(() => {
            const btn = document.getElementById('menu-access-btn');
            if (btn) {
                // Remove existing listeners by cloning
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);

                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleAccessView();
                });
            }
        }, 1500); // Wait for DOM
    }

    async loadCustomers() {
        try {
            // Show skeleton loading
            const container = document.getElementById('customer-list');
            if (container) {
                container.innerHTML = Array(6).fill(0).map(() => `
                    <div class="customer-card skeleton-card" style="background: var(--glass-bg); padding: 20px; border-radius: 16px;">
                        <div class="skeleton" style="height: 24px; width: 60%; margin-bottom: 16px; border-radius: 4px;"></div>
                        <div class="skeleton" style="height: 16px; width: 40%; margin-bottom: 8px; border-radius: 4px;"></div>
                        <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 8px; border-radius: 4px;"></div>
                        <div class="skeleton" style="height: 16px; width: 50%; margin-bottom: 16px; border-radius: 4px;"></div>
                        <div class="skeleton" style="height: 40px; width: 100%; border-radius: 8px;"></div>
                    </div>
                `).join('');
            }

            const response = await this.api.getCustomers({ limit: 100 });
            const data = response.data.customers;

            this.customers = data.map(c => new Customer(
                c._id, // MongoDB uses _id
                c.name,
                c.age,
                c.email,
                c.phone,
                c.plan,
                c.validity ? c.validity.split('T')[0] : new Date().toISOString().split('T')[0], // Safety check
                c.notes,
                c.photo || '',
                new Date(c.createdAt),
                c.memberId,
                c.balance || 0
            ));

            this.render();
        } catch (error) {
            console.error('Failed to load customers:', error);
            this.showNotification('error', 'Load Error', 'Failed to load customer list');
        }
    }

    // saveCustomers() is no longer needed as we save individually

    // addSampleData removed


    // generateId removed as backend handles ID generation


    // Customer CRUD Operations
    async addCustomer(customerData) {
        // Generate member credentials (ID is now handled by backend)
        const password = this.generateTempPassword();

        const payload = {
            name: customerData.name,
            age: customerData.age,
            email: customerData.email,
            phone: customerData.phone,
            plan: customerData.plan,
            validity: customerData.validity,
            notes: customerData.notes,
            photo: this.currentPhoto,
            memberId: customerData.memberId || '', // Use custom ID if provided
            password: password,
            isFirstLogin: true,
            balance: customerData.balance || 0
        };

        // Add Initial Payment if provided
        if (customerData.initialPayment) {
            payload.initialPayment = customerData.initialPayment;
        }

        try {
            this.setLoading(true);
            const response = await this.api.createCustomer(payload);
            const c = response.data.customer;

            const newCustomer = new Customer(
                c._id,
                c.name,
                c.age,
                c.email,
                c.phone,
                c.plan,
                c.validity.split('T')[0],
                c.notes,
                c.photo || '',
                new Date(c.createdAt),
                c.memberId,
                c.balance || 0
            );

            this.customers.push(newCustomer);
            this.currentPhoto = '';

            // Show credentials to admin with customer name for clarity
            const msg = `
                <strong>${c.name}</strong> added successfully!<br><br>
                <strong>Member ID:</strong> ${c.memberId}<br>
                <strong>Password:</strong> ${password}<br><br>
                <em>Please share these credentials with the member.</em>
            `;
            // Use persistent notification
            this.addHistoryNotification('success', 'Customer Added', msg);

            this.render();
        } finally {
            this.setLoading(false);
        }
    }

    async updateCustomer(id, customerData) {
        const index = this.customers.findIndex(c => c.id === id);
        if (index !== -1) {
            const payload = {
                name: customerData.name,
                age: customerData.age,
                email: customerData.email,
                phone: customerData.phone,
                plan: customerData.plan,
                validity: customerData.validity,
                notes: customerData.notes,
                memberId: customerData.memberId || '',
                balance: customerData.balance || 0
            };

            if (this.currentPhoto) {
                payload.photo = this.currentPhoto;
            }

            try {
                this.setLoading(true);
                const response = await this.api.updateCustomer(id, payload);
                const c = response.data.customer;

                // Update local state
                const updatedCustomer = new Customer(
                    c._id,
                    c.name,
                    c.age,
                    c.email,
                    c.phone,
                    c.plan,
                    c.validity.split('T')[0],
                    c.notes,
                    c.photo || '',
                    new Date(c.createdAt),
                    c.memberId
                );

                this.customers[index] = updatedCustomer;
                this.currentPhoto = '';
                this.showNotification('success', 'Customer Updated', `${updatedCustomer.name}'s information has been updated!`);
                this.render();
            } catch (error) {
                console.error('Update failed:', error);
                this.showNotification('error', 'Update Failed', error.message || 'Could not update customer');
            } finally {
                this.setLoading(false);
            }
        }
    }

    async deleteCustomer(id) {
        const customer = this.customers.find(c => c.id === id);
        if (customer) {
            try {
                this.setLoading(true);
                await this.api.deleteCustomer(id);
                this.customers = this.customers.filter(c => c.id !== id);
                this.showNotification('success', 'Customer Deleted', `${customer.name} has been removed from the system.`);
                this.render();
            } catch (error) {
                console.error('Delete failed:', error);
                this.showNotification('error', 'Delete Failed', error.message || 'Could not delete customer');
            } finally {
                this.setLoading(false);
            }
        }
    }

    // Filtering and Sorting
    getFilteredCustomers() {
        let filtered = [...this.customers];

        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(query) ||
                c.email.toLowerCase().includes(query) ||
                c.phone.includes(query)
            );
        }

        // Apply status filter
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(c => c.getStatus() === this.currentFilter);
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.currentSort) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'date-newest':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'date-oldest':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'validity':
                    return new Date(a.validity) - new Date(b.validity);
                default:
                    return 0;
            }
        });

        return filtered;
    }

    // Statistics
    getStats() {
        const total = this.customers.length;
        const active = this.customers.filter(c => c.getStatus() === 'active').length;
        const expiring = this.customers.filter(c => c.getStatus() === 'expiring').length;
        const expired = this.customers.filter(c => c.getStatus() === 'expired').length;

        return { total, active, expiring, expired };
    }

    async updateAttendanceStats() {
        try {
            // Get stats for today
            const today = this.getLocalDateString();
            const response = await this.api.getAttendanceStats(today);

            if (response.data && response.data.daily) {
                const stats = response.data.daily;

                // Update DOM elements
                // Using helper to animate numbers
                this.animateValue(document.getElementById('today-checkins'), 0, stats.total, 1000);
                this.animateValue(document.getElementById('active-checkins'), 0, stats.active, 1000);
                this.animateValue(document.getElementById('expired-checkins'), 0, stats.expired, 1000);
            }
        } catch (error) {
            console.error('Failed to update attendance stats:', error);
        }
    }

    // Notification System
    checkExpiringPlans() {
        const expiring = this.customers.filter(c => c.getStatus() === 'expiring');
        const expired = this.customers.filter(c => c.getStatus() === 'expired');

        // Update Notify Button Visibility
        const notifyBtn = document.getElementById('notify-expired-btn');
        if (expired.length > 0) {
            notifyBtn.style.display = 'flex';
            notifyBtn.onclick = () => this.notifyExpiredCustomers();
        } else {
            notifyBtn.style.display = 'none';
        }

        if (expiring.length > 0) {
            this.showNotification(
                'warning',
                'Plans Expiring Soon',
                `${expiring.length} customer plan(s) expiring within 7 days!`
            );
        }

        if (expired.length > 0) {
            this.showNotification(
                'error',
                'Expired Plans',
                `${expired.length} customer plan(s) have expired and need renewal!`
            );
        }
    }

    async notifyExpiredCustomers() {
        try {
            // EmailJS Configuration
            const SERVICE_ID = 'service_ox63ro4';
            const TEMPLATE_ID = 'template_hsl7iv5';
            const PUBLIC_KEY = 'YeGoWt9Ev-1P5yskh';

            // Initialize EmailJS (only needs to be done once)
            emailjs.init(PUBLIC_KEY);

            this.showNotification('warning', 'Sending Emails...', 'Preparing email notifications...');

            // Filter customers whose plans expire within 7 days or have already expired
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);

            const expiringCustomers = this.customers.filter(customer => {
                const validityDate = new Date(customer.validity);
                validityDate.setHours(0, 0, 0, 0);
                const diffTime = validityDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays >= -7 && diffDays <= 7; // Last 7 days or next 7 days
            });

            if (expiringCustomers.length === 0) {
                this.showNotification('info', 'No Emails to Send', 'No customers with expiring plans found.');
                return;
            }

            let sentCount = 0;
            let failedCount = 0;

            // Send emails one by one
            for (const customer of expiringCustomers) {
                try {
                    const templateParams = {
                        to_email: customer.email,
                        to_name: customer.name,
                        plan_type: customer.plan,
                        expiry_date: new Date(customer.validity).toLocaleDateString('en-IN'),
                        gym_name: 'Mother Fitness Gym'
                    };

                    await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
                    sentCount++;
                } catch (error) {
                    console.error(`Failed to send email to ${customer.email}:`, error);
                    failedCount++;
                }
            }

            if (sentCount > 0) {
                this.showNotification('success', 'Emails Sent', `Successfully sent ${sentCount} email(s).`);
            }

            if (failedCount > 0) {
                this.showNotification('warning', 'Some Failed', `Failed to send ${failedCount} email(s). Check console.`);
            }

        } catch (error) {
            console.error('Failed to send emails:', error);
            this.showNotification('error', 'Sending Failed', error.message || 'Could not send emails.');
        }
    }

    async importCustomersFromExcel(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showNotification('warning', 'Importing...', 'Reading Excel file...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    this.showNotification('error', 'Import Failed', 'Excel file is empty or invalid.');
                    return;
                }

                let successCount = 0;
                let failCount = 0;

                for (const row of jsonData) {
                    // Map Excel columns to Customer object
                    // Expected columns: Name, Age, Email, Phone, Plan, Validity, Notes
                    const customerData = {
                        name: row['Name'] || row['name'],
                        age: row['Age'] || row['age'],
                        email: row['Email'] || row['email'],
                        phone: row['Phone'] || row['phone'],
                        plan: row['Plan'] || row['plan'],
                        validity: row['Validity'] || row['validity'], // Ensure date format is YYYY-MM-DD
                        notes: row['Notes'] || row['notes'] || ''
                    };

                    // Basic validation
                    if (customerData.name && customerData.phone && customerData.plan) {
                        // Format date if needed (Excel dates can be tricky)
                        if (customerData.validity && !isNaN(new Date(customerData.validity).getTime())) {
                            customerData.validity = new Date(customerData.validity).toISOString().split('T')[0];
                        } else {
                            // Default validity if missing/invalid
                            const d = new Date();
                            d.setMonth(d.getMonth() + 1);
                            customerData.validity = d.toISOString().split('T')[0];
                        }

                        await this.addCustomer(customerData);
                        successCount++;
                    } else {
                        failCount++;
                    }
                }

                this.showNotification('success', 'Import Complete', `Successfully imported ${successCount} customers. ${failCount > 0 ? `(${failCount} failed)` : ''}`);

                // Reset input
                event.target.value = '';

            } catch (error) {
                console.error('Import error:', error);
                this.showNotification('error', 'Import Failed', 'Could not process the Excel file.');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    exportToExcel() {
        if (this.customers.length === 0) {
            this.showNotification('warning', 'No Data', 'No customers to export.');
            return;
        }

        try {
            // Prepare data for export (exclude large photo strings)
            const exportData = this.customers.map(c => ({
                'Name': c.name,
                'Age': c.age,
                'Email': c.email,
                'Phone': c.phone,
                'Plan': c.plan,
                'Validity': c.validity,
                'Status': c.getStatus().toUpperCase(),
                'Notes': c.notes,
                'Joined Date': new Date(c.createdAt).toLocaleDateString()
            }));

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Customers");

            // Generate filename with date
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `MotherFitness_Customers_${dateStr}.xlsx`;

            // Save file
            XLSX.writeFile(wb, fileName);

            this.showNotification('success', 'Export Successful', 'Customer data exported to Excel.');
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('error', 'Export Failed', 'Could not export data. See console for details.');
        }
    }

    showNotification(type, title, message) {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        notification.innerHTML = `
            <div class="notification-icon">${icons[type]}</div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
        `;

        container.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s reverse';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // ===================================
    // Payment Management
    // ===================================

    togglePaymentView() {
        this.toggleView('payments');
    }


    async loadPayments() {
        try {
            const tbody = document.getElementById('payment-table-body');
            if (tbody) {
                tbody.innerHTML = Array(5).fill(0).map(() => `
                    <tr>
                        <td colspan="7">
                            <div class="skeleton" style="height: 40px; width: 100%; border-radius: 8px;"></div>
                        </td>
                    </tr>
                `).join('');
            }

            const response = await this.api.getPayments({ limit: 1000 });
            this.payments = response.data.payments;
            this.renderPayments(this.payments);
        } catch (error) {
            console.error('Failed to load payments:', error);
            this.showNotification('error', 'Error', 'Failed to load payments');
        }
    }

    renderPayments(payments) {
        const tbody = document.getElementById('payment-table-body');
        tbody.innerHTML = '';

        if (payments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        <div style="width: 200px; height: 200px; margin: 0 auto;">
                            <lottie-player src="https://assets9.lottiefiles.com/packages/lf20_s8pbrcfw.json"  background="transparent"  speed="1"  style="width: 100%; height: 100%;"  loop  autoplay></lottie-player>
                        </div>
                        <p style="color: var(--text-muted); margin-top: 10px;">No payments found</p>
                    </td>
                </tr>
            `;
            return;
        }

        payments.forEach(payment => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #eee';

            // Backend returns paymentDate, paymentMethod, planType
            const date = new Date(payment.paymentDate).toLocaleDateString();

            tr.innerHTML = `
                <td style="padding: 12px;">${date}</td>
                <td style="padding: 12px;">${payment.customerName}</td>
                <td style="padding: 12px;">₹${payment.amount}</td>
                <td style="padding: 12px;">${payment.paymentMethod}</td>
                <td style="padding: 12px;">${payment.planType}</td>
                <td style="padding: 12px;">
                    <span class="status-badge status-${payment.status ? payment.status.toLowerCase() : 'completed'}">
                        ${payment.status || 'Completed'}
                    </span>
                </td>
                <td style="padding: 12px;">
                    <button onclick="app.deletePayment('${payment._id}')" class="delete-btn" title="Delete Payment">
                        🗑️
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    filterPayments() {
        const query = document.getElementById('payment-search').value.toLowerCase();
        const filtered = this.payments.filter(p =>
            p.customerName.toLowerCase().includes(query) ||
            p.receiptNumber?.toLowerCase().includes(query)
        );
        this.renderPayments(filtered);
    }

    async exportPayments() {
        const payments = this.payments || [];

        if (payments.length === 0) {
            this.showNotification('warning', 'No Data', 'No payment records to export.');
            return;
        }

        try {
            const exportData = payments.map(p => ({
                'Date': new Date(p.paymentDate).toLocaleDateString(),
                'Customer Name': p.customerName,
                'Amount': p.amount,
                'Method': p.paymentMethod,
                'Plan': p.planType,
                'Status': p.status,
                'Receipt No': p.receiptNumber || '-',
                'Added By': p.addedBy ? p.addedBy.name : 'System'
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Payments");

            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `MotherFitness_Payments_${dateStr}.xlsx`;

            XLSX.writeFile(wb, fileName);

            this.showNotification('success', 'Export Successful', 'Payment data exported to Excel.');
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('error', 'Export Failed', 'Could not export data.');
        }
    }

    async syncBadges() {
        try {
            if (!confirm('This will scan all customers and retroactive award missing badges. Continue?')) {
                return;
            }

            this.showNotification('info', 'Syncing...', 'Starting badge synchronization...');

            const response = await this.api.syncBadges();
            const count = response.data.updatedCount;

            this.showNotification('success', 'Sync Complete', `Successfully updated ${count} customers with new badges.`);
        } catch (error) {
            console.error('Badge sync failed:', error);
            this.showNotification('error', 'Sync Failed', error.message || 'Could not sync badges.');
        }
    }

    openPaymentModal(customerId = null) {
        const modal = document.getElementById('payment-modal');
        const form = document.getElementById('payment-form');
        form.reset();

        // Set default date to today
        document.getElementById('payment-date').valueAsDate = new Date();

        if (customerId) {
            const customer = this.customers.find(c => c.id === customerId || c._id === customerId);
            if (customer) {
                document.getElementById('payment-customer-id').value = customer.id;
                document.getElementById('payment-customer-name').value = customer.name;

                // Auto-select plan based on customer's plan
                const planSelect = document.getElementById('payment-plan');
                if (customer.plan) planSelect.value = customer.plan;
            }
        }

        modal.style.display = 'flex';
    }

    closePaymentModal() {
        document.getElementById('payment-modal').style.display = 'none';
    }

    async handlePaymentSubmit(e) {
        e.preventDefault();

        const customerId = document.getElementById('payment-customer-id').value;
        if (!customerId) {
            this.showNotification('error', 'Error', 'No customer selected');
            return;
        }

        const paymentData = {
            customerId,
            amount: document.getElementById('payment-amount').value,
            paymentDate: document.getElementById('payment-date').value,
            paymentMethod: document.getElementById('payment-method').value,
            planType: document.getElementById('payment-plan').value,
            receiptNumber: document.getElementById('payment-receipt').value,
            notes: document.getElementById('payment-notes').value,
            status: 'completed'
        };

        try {
            console.log('Submitting payment for customer:', customerId);
            const response = await this.api.createPayment(paymentData);
            console.log('Payment response:', response.data);

            this.showNotification('success', 'Success', 'Payment recorded successfully');
            this.closePaymentModal();

            // Update local customer state immediately
            if (response.data.customer) {
                const updatedCustomer = response.data.customer;
                console.log('Updated customer from backend:', updatedCustomer);

                const index = this.customers.findIndex(c =>
                    c.id === updatedCustomer._id || c.id === customerId
                );

                console.log('Found customer at index:', index);

                if (index !== -1) {
                    console.log('Old plan:', this.customers[index].plan, 'validity:', this.customers[index].validity);

                    this.customers[index] = new Customer(
                        updatedCustomer._id,
                        updatedCustomer.name,
                        updatedCustomer.age,
                        updatedCustomer.email,
                        updatedCustomer.phone,
                        updatedCustomer.plan,
                        updatedCustomer.validity.split('T')[0],
                        updatedCustomer.notes,
                        updatedCustomer.photo || this.customers[index].photo,
                        new Date(updatedCustomer.createdAt)
                    );

                    console.log('New plan:', this.customers[index].plan, 'validity:', this.customers[index].validity);
                    console.log('Calling render()...');
                    this.render();
                    console.log('Render completed');
                } else {
                    console.warn('Customer not found in local array');
                }
            }

            // Add payment to local array
            if (response.data.payment) {
                this.payments.unshift(response.data.payment);
                const paymentView = document.getElementById('payment-view');
                if (paymentView && paymentView.style.display !== 'none') {
                    this.renderPayments(this.payments);
                }
            }
        } catch (error) {
            console.error('Payment submission error:', error);
            this.showNotification('error', 'Error', error.message || 'Failed to save payment');
        }
    }

    async deletePayment(id) {
        if (!confirm('Are you sure you want to delete this payment?')) return;

        try {
            await this.api.deletePayment(id);
            this.showNotification('success', 'Success', 'Payment deleted');
            this.loadPayments();
        } catch (error) {
            this.showNotification('error', 'Error', 'Failed to delete payment');
        }
    }

    // ===================================
    // Member Credentials Helper
    // ===================================

    async generateNextMemberId() {
        // Simple logic: find max ID in loaded customers
        // In production, this should be done by backend, but for now we do it here
        // or fetch from backend. Since we load all customers, we can calculate it.

        const memberIds = this.customers
            .map(c => c.memberId)
            .filter(id => id && id.startsWith('U'))
            .map(id => parseInt(id.substring(1)));

        const maxId = memberIds.length > 0 ? Math.max(...memberIds) : 0;
        return 'U' + String(maxId + 1).padStart(3, '0');
    }

    generateTempPassword() {
        return Math.random().toString(36).slice(-8); // 8 char random string
    }

    // Event Listeners
    setupEventListeners() {
        // Inject Payments menu item if missing (Fallback for HTML edit failure)
        if (!document.getElementById('menu-payments-btn')) {
            const attendanceBtn = document.getElementById('menu-attendance-btn');
            if (attendanceBtn) {
                const paymentsBtn = document.createElement('div');
                paymentsBtn.className = 'menu-item';
                paymentsBtn.id = 'menu-payments-btn';
                paymentsBtn.onclick = () => {
                    this.togglePaymentView();
                    this.closeHamburgerMenu();
                };
                paymentsBtn.innerHTML = `
                    <span class="menu-icon">💳</span>
                    <span class="menu-text">Payments</span>
                `;
                attendanceBtn.parentNode.insertBefore(paymentsBtn, attendanceBtn.nextSibling);
            }
        }

        // Hamburger menu button listener
        const hamburgerBtn = document.getElementById('hamburger-btn');
        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => {
                this.openHamburgerMenu();
            });
        }

        // Announcements menu button 
        const announcementsBtn = document.getElementById('menu-announcements-btn');
        if (announcementsBtn) {
            announcementsBtn.addEventListener('click', () => {
                this.toggleAnnouncementView();
                // toggleAnnouncementView already calls closeHamburgerMenu but being explicit here
                this.closeHamburgerMenu();
            });
        }

        const homeBtn = document.getElementById('menu-home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.toggleView('list');
                this.closeHamburgerMenu();
            });
        }

        const analyticsBtn = document.getElementById('menu-analytics-btn');
        if (analyticsBtn) {
            analyticsBtn.addEventListener('click', () => {
                this.toggleView('analytics');
                this.closeHamburgerMenu();
            });
        }

        const accessBtn = document.getElementById('menu-access-btn');
        if (accessBtn) {
            accessBtn.addEventListener('click', () => {
                this.toggleView('access');
                this.closeHamburgerMenu();
            });
        }

        const attendanceBtn = document.getElementById('menu-attendance-btn');
        if (attendanceBtn) {
            attendanceBtn.addEventListener('click', () => {
                this.toggleAttendanceView();
                this.closeHamburgerMenu();
            });
        }

        const intelligenceBtn = document.getElementById('menu-intelligence-btn');
        if (intelligenceBtn) {
            intelligenceBtn.addEventListener('click', () => {
                this.toggleIntelligenceView();
                this.closeHamburgerMenu();
            });
        }

        const deviceSettingsBtn = document.getElementById('menu-device-settings-btn');
        if (deviceSettingsBtn) {
            deviceSettingsBtn.addEventListener('click', () => {
                this.toggleDeviceSettings();
                this.closeHamburgerMenu();
            });
        }

        const exportBtn = document.getElementById('menu-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportToExcel();
                this.closeHamburgerMenu();
            });
        }

        // Add customer button (in menu)
        const addCustomerBtn = document.getElementById('menu-add-customer-btn');
        if (addCustomerBtn) {
            addCustomerBtn.addEventListener('click', () => {
                this.openCustomerModal();
                this.closeHamburgerMenu();
            });
        }

        // Dark mode toggle (in menu)
        const themeToggleBtn = document.getElementById('menu-theme-toggle');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
                this.closeHamburgerMenu();
            });
        }

        // Password change
        const passwordBtn = document.getElementById('menu-password-btn');
        if (passwordBtn) {
            passwordBtn.addEventListener('click', () => {
                this.openPasswordModal();
                this.closeHamburgerMenu();
            });
        }

        // Logout button
        const logoutBtn = document.getElementById('menu-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }

        // Import Excel
        const importBtn = document.getElementById('menu-import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', (e) => {
                document.getElementById('import-excel-input').click();
                this.closeHamburgerMenu();
            });
        }

        const importInput = document.getElementById('import-excel-input');
        if (importInput) {
            importInput.addEventListener('change', (e) => {
                this.importCustomersFromExcel(e);
            });
        }

        // Password form submit
        document.getElementById('password-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const currentPwd = document.getElementById('current-password').value;
            const newPwd = document.getElementById('new-password').value;
            const confirmPwd = document.getElementById('confirm-password').value;
            this.handlePasswordChange(currentPwd, newPwd, confirmPwd);
        });

        // Attendance date filter
        document.getElementById('attendance-date-filter').addEventListener('change', () => {
            if (this.currentView === 'attendance') {
                this.renderAttendance();
            }
        });

        // Export attendance
        document.getElementById('export-attendance-btn').addEventListener('click', () => {
            this.exportAttendance();
        });

        // Search input
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.render();
        });

        // Filter select
        document.getElementById('filter-status').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.render();
        });

        // Sort select
        document.getElementById('sort-by').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.render();
        });

        // Plan type change - auto-calculate validity
        document.getElementById('customer-plan').addEventListener('change', (e) => {
            this.calculatePlanValidity(e.target.value);
        });

        // Photo upload/camera
        document.getElementById('add-photo-btn').addEventListener('click', () => {
            this.openCameraModal();
        });

        document.getElementById('profile-photo-input').addEventListener('change', (e) => {
            this.handlePhotoUpload(e);
        });

        document.getElementById('profile-photo-preview').addEventListener('click', () => {
            if (this.currentPhoto) {
                this.openImageModal(this.currentPhoto, 'current');
            }
        });

        // Image modal actions
        document.getElementById('edit-photo-btn').addEventListener('click', () => {
            this.editPhoto();
        });

        document.getElementById('delete-photo-btn').addEventListener('click', () => {
            this.deletePhoto();
        });

        // Customer form submit
        document.getElementById('customer-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Delete confirmation
        document.getElementById('confirm-delete-btn').addEventListener('click', () => {
            if (this.deleteCustomerId) {
                this.deleteCustomer(this.deleteCustomerId);
                this.closeDeleteModal();
            }
        });

        // Close modals on outside click
        document.getElementById('customer-modal').addEventListener('click', (e) => {
            if (e.target.id === 'customer-modal') {
                this.closeCustomerModal();
            }
        });

        document.getElementById('delete-modal').addEventListener('click', (e) => {
            if (e.target.id === 'delete-modal') {
                this.closeDeleteModal();
            }
        });

        document.getElementById('image-modal').addEventListener('click', (e) => {
            if (e.target.id === 'image-modal') {
                this.closeImageModal();
            }
        });

        // Camera modal events
        document.getElementById('capture-photo-btn').addEventListener('click', () => {
            this.capturePhoto();
        });

        document.getElementById('camera-modal').addEventListener('click', (e) => {
            if (e.target.id === 'camera-modal') {
                this.closeCameraModal();
            }
        });
    }

    // Plan Validity Calculation
    calculatePlanValidity(planType) {
        if (!planType) return;

        const today = new Date();
        let validityDate = new Date(today);

        switch (planType) {
            case 'Monthly':
                validityDate.setMonth(validityDate.getMonth() + 1);
                break;
            case 'Quarterly':
                validityDate.setMonth(validityDate.getMonth() + 3);
                break;
            case 'Half-Yearly':
                validityDate.setMonth(validityDate.getMonth() + 6);
                break;
            case 'Yearly':
                validityDate.setFullYear(validityDate.getFullYear() + 1);
                break;
        }

        document.getElementById('customer-validity').value = validityDate.toISOString().split('T')[0];
    }

    // Photo Management
    async handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('error', 'File Too Large', 'Please select an image smaller than 5MB');
            return;
        }

        try {
            this.showNotification('warning', 'Uploading...', 'Uploading photo...');
            const response = await this.api.uploadPhoto(file);

            // Validate response - handle Cloudinary (photoUrl/url/secure_url) and local uploads (path)
            const photoUrl = response.data?.photoUrl || response.data?.url || response.data?.secure_url ||
                (response.data?.path ? (this.api.baseUrl || window.location.origin) + response.data.path : null);

            if (!photoUrl) {
                console.error('Invalid upload response:', response);
                throw new Error('Server did not return a valid photo URL');
            }

            this.currentPhoto = photoUrl;
            this.displayPhoto(this.currentPhoto);
            this.showNotification('success', 'Upload Complete', 'Photo uploaded successfully');
        } catch (error) {
            console.error('Upload failed:', error);
            this.showNotification('error', 'Upload Failed', error.message || 'Could not upload photo');
        }
    }

    displayPhoto(photoData) {
        const img = document.getElementById('profile-image');
        const placeholder = document.getElementById('profile-placeholder');

        img.src = photoData;
        img.style.display = 'block';
        placeholder.style.display = 'none';
    }

    clearPhotoPreview() {
        const img = document.getElementById('profile-image');
        const placeholder = document.getElementById('profile-placeholder');

        img.src = '';
        img.style.display = 'none';
        placeholder.style.display = 'flex';
        this.currentPhoto = '';
    }

    openImageModal(photoData, source) {
        if (source === 'customer') {
            this.viewingPhotoCustomerId = photoData.customerId;
        }

        document.getElementById('enlarged-image').src = source === 'current' ? photoData : photoData.photo;
        document.getElementById('image-modal').classList.add('show');
    }

    closeImageModal() {
        document.getElementById('image-modal').classList.remove('show');
        this.viewingPhotoCustomerId = null;
    }

    editPhoto() {
        this.closeImageModal();
        document.getElementById('profile-photo-input').click();
    }

    async deletePhoto() {
        try {
            if (this.viewingPhotoCustomerId) {
                // Delete photo from existing customer
                const customer = this.customers.find(c => c.id === this.viewingPhotoCustomerId || c._id === this.viewingPhotoCustomerId);
                if (customer && customer.photo) {
                    // Extract Cloudinary public_id from URL
                    // Format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{folder}/{file}.ext
                    // public_id should be: {folder}/{file} (without extension and version)
                    const uploadIndex = customer.photo.indexOf('/upload/');
                    if (uploadIndex !== -1) {
                        const afterUpload = customer.photo.substring(uploadIndex + 8); // Skip '/upload/'
                        const parts = afterUpload.split('/');
                        // Remove version (v123456) if present
                        const startIndex = parts[0].startsWith('v') && !isNaN(parts[0].substring(1)) ? 1 : 0;
                        // Join remaining parts and remove file extension
                        const pathWithExt = parts.slice(startIndex).join('/');
                        const publicId = pathWithExt.substring(0, pathWithExt.lastIndexOf('.'));

                        // Delete from server
                        await this.api.deletePhoto(publicId);

                        // Update customer record
                        await this.api.updateCustomer(customer.id || customer._id, { photo: '' });

                        // Update local state
                        customer.photo = '';
                        this.showNotification('success', 'Photo Deleted', 'Profile photo has been removed');
                        this.render();
                    }
                }
            } else {
                // Delete current photo being added (orphaned upload)
                if (this.currentPhoto) {
                    const uploadIndex = this.currentPhoto.indexOf('/upload/');
                    if (uploadIndex !== -1) {
                        const afterUpload = this.currentPhoto.substring(uploadIndex + 8);
                        const parts = afterUpload.split('/');
                        const startIndex = parts[0].startsWith('v') && !isNaN(parts[0].substring(1)) ? 1 : 0;
                        const pathWithExt = parts.slice(startIndex).join('/');
                        const publicId = pathWithExt.substring(0, pathWithExt.lastIndexOf('.'));

                        await this.api.deletePhoto(publicId);
                        this.showNotification('success', 'Photo Removed', 'Photo has been removed');
                    }
                    this.clearPhotoPreview();
                }
            }
            this.closeImageModal();
        } catch (error) {
            console.error('Photo delete failed:', error);
            // Don't show error notification for non-existent files
            if (!error.message || !error.message.includes('File not found')) {
                this.showNotification('error', 'Error', 'Failed to delete photo');
            }
        }
    }

    // Camera Functions
    async openCameraModal() {
        const modal = document.getElementById('camera-modal');
        const video = document.getElementById('camera-video');

        try {
            // Request camera access
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: false
            });

            video.srcObject = this.cameraStream;
            this.cameraActive = true;
            modal.classList.add('show');
        } catch (error) {
            console.error('Camera access denied:', error);
            this.showNotification('error', 'Camera Access Denied',
                'Please allow camera access to take photos.');
        }
    }

    closeCameraModal() {
        const modal = document.getElementById('camera-modal');

        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }

        this.cameraActive = false;
        modal.classList.remove('show');
    }

    capturePhoto() {
        const video = document.getElementById('camera-video');
        const canvas = document.getElementById('camera-canvas');
        const context = canvas.getContext('2d');

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current video frame to canvas (flip horizontally for natural look)
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas to base64 image
        this.currentPhoto = canvas.toDataURL('image/jpeg', 0.8);
        this.displayPhoto(this.currentPhoto);

        // Close camera modal
        this.closeCameraModal();

        this.showNotification('success', 'Photo Captured', 'Profile photo has been captured successfully!');
    }

    // Modal Management
    openCustomerModal(customerId = null) {
        this.editingCustomerId = customerId;
        const modal = document.getElementById('customer-modal');
        const form = document.getElementById('customer-form');
        const title = document.getElementById('modal-title');
        const submitBtn = document.getElementById('submit-btn');

        form.reset();
        this.clearPhotoPreview();

        if (customerId) {
            // Edit mode
            const customer = this.customers.find(c => c.id === customerId);
            if (customer) {
                title.textContent = 'Edit Customer';
                submitBtn.innerHTML = '<span class="btn-icon">💾</span> Update Customer';

                document.getElementById('customer-name').value = customer.name;
                document.getElementById('customer-age').value = customer.age;
                document.getElementById('customer-email').value = customer.email;
                document.getElementById('customer-phone').value = customer.phone;
                document.getElementById('customer-plan').value = customer.plan;
                document.getElementById('customer-validity').value = customer.validity;
                document.getElementById('customer-notes').value = customer.notes;
                document.getElementById('customer-member-id').value = customer.memberId || '';
                document.getElementById('customer-balance').value = customer.balance || 0;

                if (customer.photo) {
                    this.currentPhoto = customer.photo;
                    this.displayPhoto(customer.photo);
                }
            }
            // Hide Initial Payment Section in Edit Mode
            const paymentSection = document.getElementById('initial-payment-section');
            if (paymentSection) {
                paymentSection.style.display = 'none';
            }
        } else {
            // Add mode
            title.textContent = 'Add New Customer';
            submitBtn.innerHTML = '<span class="btn-icon">💾</span> Save Customer';

            // Show Initial Payment Section
            const paymentSection = document.getElementById('initial-payment-section');
            if (paymentSection) {
                paymentSection.style.display = 'block';
                // Reset inputs
                document.getElementById('initial-payment-amount').value = '';
                document.getElementById('initial-payment-method').value = 'Cash';
                document.getElementById('initial-payment-receipt').value = '';
                document.getElementById('customer-balance').value = 0;
            }

            // Set default validity to 1 month from today
            const defaultDate = new Date();
            defaultDate.setMonth(defaultDate.getMonth() + 1);
            document.getElementById('customer-validity').value = defaultDate.toISOString().split('T')[0];
        }

        modal.classList.add('show');
    }

    closeCustomerModal() {
        document.getElementById('customer-modal').classList.remove('show');
        this.editingCustomerId = null;
        this.clearPhotoPreview();
    }

    openDeleteModal(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (customer) {
            this.deleteCustomerId = customerId;
            document.getElementById('delete-customer-name').textContent = customer.name;
            document.getElementById('delete-modal').classList.add('show');
        }
    }

    closeDeleteModal() {
        document.getElementById('delete-modal').classList.remove('show');
        this.deleteCustomerId = null;
    }

    handleFormSubmit() {
        const customerData = {
            name: document.getElementById('customer-name').value.trim(),
            age: parseInt(document.getElementById('customer-age').value),
            email: document.getElementById('customer-email').value.trim(),
            phone: document.getElementById('customer-phone').value.trim(),
            plan: document.getElementById('customer-plan').value,
            validity: document.getElementById('customer-validity').value,
            notes: document.getElementById('customer-notes').value.trim(),
            memberId: document.getElementById('customer-member-id').value.trim(),
            balance: parseFloat(document.getElementById('customer-balance').value) || 0
        };

        // Capture Initial Payment Data (Only for new customers)
        if (!this.editingCustomerId) {
            const amount = document.getElementById('initial-payment-amount').value;
            if (amount && parseFloat(amount) > 0) {
                customerData.initialPayment = {
                    amount: parseFloat(amount),
                    paymentMethod: document.getElementById('initial-payment-method').value,
                    receiptNumber: document.getElementById('initial-payment-receipt').value.trim()
                };
            }
        }

        if (this.editingCustomerId) {
            this.updateCustomer(this.editingCustomerId, customerData);
        } else {
            this.addCustomer(customerData);
        }

        this.closeCustomerModal();
    }

    // Rendering
    render() {
        this.renderStats();
        this.renderCustomerList();
    }

    async renderStats() {
        try {
            const response = await this.api.getDashboardStats();
            const stats = response.data.customers; // Backend returns data.customers, not data.stats

            this.animateValue(document.getElementById('total-customers'), 0, stats.total, 800);
            this.animateValue(document.getElementById('active-customers'), 0, stats.active, 800);
            this.animateValue(document.getElementById('expiring-customers'), 0, stats.expiring, 800);
            this.animateValue(document.getElementById('expired-customers'), 0, stats.expired, 800);

            // Update button visibility on every render
            const notifyBtn = document.getElementById('notify-expired-btn');
            if (stats.expired > 0) {
                notifyBtn.style.display = 'flex';
                notifyBtn.onclick = () => this.notifyExpiredCustomers();
            } else {
                notifyBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    renderCustomerList() {
        const container = document.getElementById('customer-list');
        const emptyState = document.getElementById('empty-state');
        const customers = this.getFilteredCustomers();

        if (customers.length === 0) {
            container.innerHTML = '';
            // CSS/HTML for empty state (replacement for broken Lottie)
            emptyState.innerHTML = `
                <div class="empty-state-icon" style="font-size: 80px; margin-bottom: 20px;">📂</div>
                <h2>No Customers Found</h2>
                <p>Start by adding your first customer to the system</p>
                <button class="btn btn-primary" onclick="app.openCustomerModal()">
                    <span class="btn-icon">+</span>
                    Add First Customer
                </button>
            `;
            emptyState.classList.add('show');
            return;
        }

        emptyState.classList.remove('show');
        container.innerHTML = customers.map(customer => {
            try {
                return this.renderCustomerCard(customer);
            } catch (e) {
                console.error('Failed to render card for customer:', customer.id, e);
                return '';
            }
        }).join('');

        // Attach event listeners to action buttons
        customers.forEach(customer => {
            document.getElementById(`edit-${customer.id}`).addEventListener('click', () => {
                this.openCustomerModal(customer.id);
            });

            document.getElementById(`pay-${customer.id}`).addEventListener('click', () => {
                this.openPaymentModal(customer.id);
            });

            document.getElementById(`delete-${customer.id}`).addEventListener('click', () => {
                this.openDeleteModal(customer.id);
            });
        });
    }

    toggleView(targetView = 'list') {
        const listSection = document.querySelector('.customer-list-section');
        const controlsSection = document.querySelector('.controls-section');
        const analyticsSection = document.getElementById('analytics-dashboard');
        const attendanceSection = document.getElementById('attendance-dashboard');
        const intelligenceSection = document.getElementById('intelligence-dashboard');
        const deviceSettingsSection = document.getElementById('device-settings-dashboard');
        const accessSection = document.getElementById('access-dashboard');
        const paymentSection = document.getElementById('payment-view'); // Assuming payment-view is also a "dashboard"

        console.log(`Switching view to: ${targetView}`);

        // Hide all dashboards first
        const dashboards = [
            analyticsSection,
            attendanceSection,
            intelligenceSection,
            deviceSettingsSection,
            accessSection,
            paymentSection
        ];

        dashboards.forEach(el => {
            if (el) el.style.display = 'none';
        });

        // Stop biometric system if switching away from access view
        if (this.currentView === 'access' && targetView !== 'access') {
            this.biometricSystem.stop();
        }

        // Handle view switching
        if (targetView === 'list' || (targetView === this.currentView && targetView !== 'list')) {
            // Show main list view
            this.currentView = 'list';
            if (listSection) listSection.style.display = 'block';
            if (controlsSection) controlsSection.style.display = 'flex';
        } else {
            // Hide main list view
            if (listSection) listSection.style.display = 'none';
            if (controlsSection) controlsSection.style.display = 'none';

            // Show target dashboard
            let targetEl = null;
            switch (targetView) {
                case 'analytics': targetEl = analyticsSection; break;
                case 'attendance': targetEl = attendanceSection; break;
                case 'intelligence': targetEl = intelligenceSection; break;
                case 'device-settings': targetEl = deviceSettingsSection; break;
                case 'access': targetEl = accessSection; break;
                case 'payments': targetEl = paymentSection; break;
            }

            if (targetEl) {
                targetEl.style.display = targetView === 'analytics' ? 'grid' : 'block';
                this.currentView = targetView;

                // Trigger specific view logic
                if (targetView === 'analytics') setTimeout(() => this.renderCharts(), 50);
                if (targetView === 'attendance') this.renderAttendance();
                if (targetView === 'intelligence') this.loadIntelligenceData();
                if (targetView === 'device-settings') {
                    this.loadZKTecoStatus();
                    this.updateOccupancy();
                }
                if (targetView === 'access') {
                    this.loadPorts();
                    this.biometricSystem.start();
                }
                if (targetView === 'payments') {
                    this.loadPayments();
                }
            }
        }

        this.updateMenuLabels();
        this.closeHamburgerMenu();
    }

    async renderAttendance() {
        const dateFilter = document.getElementById('attendance-date-filter').value;
        const today = this.getLocalDateString();

        try {
            // Fetch attendance data
            // If date filter is set, fetch for that date. Otherwise fetch all records.
            const response = await this.api.getAttendance(dateFilter ? { date: dateFilter } : {});
            let attendance = response.data.attendance;

            // --- DAILY FILTER IMPLEMENTATION ---
            // Unless the user explicitly selected a date filter, show ONLY today's records.
            if (!dateFilter) {
                const todayStr = new Date().toLocaleDateString('en-IN');
                attendance = attendance.filter(record => {
                    const recordDate = new Date(record.timestamp).toLocaleDateString('en-IN');
                    return recordDate === todayStr;
                });
            }
            // -----------------------------------

            // Update stats
            this.updateAttendanceStats();

            // Render list
            const container = document.getElementById('attendance-list');
            const emptyState = document.getElementById('attendance-empty-state');

            if (attendance.length === 0) {
                container.innerHTML = '';
                emptyState.style.display = 'flex';
                // Update message if filtered
                if (!dateFilter) {
                    emptyState.querySelector('h2').textContent = "No Check-ins Today";
                    emptyState.querySelector('p').textContent = "Attendance records will appear here as members check in.";
                }
                return;
            }

            emptyState.style.display = 'none';
            container.innerHTML = attendance.map(record => this.renderAttendanceRecord(record)).join('');
        } catch (error) {
            console.error('Failed to render attendance:', error);
            this.showNotification('error', 'Attendance Error', 'Failed to load attendance records');
        }
    }

    updateMenuLabels() {
        const analyticsBtn = document.getElementById('menu-analytics-btn');
        const attendanceBtn = document.getElementById('menu-attendance-btn');

        if (analyticsBtn) {
            const analyticsText = analyticsBtn.querySelector('.menu-text');
            if (this.currentView === 'analytics') {
                analyticsText.textContent = 'Customer List';
            } else {
                analyticsText.textContent = 'Analytics';
            }
        }

        if (attendanceBtn) {
            const attendanceText = attendanceBtn.querySelector('.menu-text');
            if (this.currentView === 'attendance') {
                attendanceText.textContent = 'Customer List';
            } else {
                attendanceText.textContent = 'Attendance';
            }
        }
    }

    exportAttendance() {
        const attendance = this.loadAttendance();

        if (attendance.length === 0) {
            this.showNotification('warning', 'No Data', 'No attendance records to export.');
            return;
        }

        try {
            const exportData = attendance.map(a => ({
                'Customer Name': a.customerName,
                'Date': a.date,
                'Time': a.time,
                'Status': a.membershipStatus.toUpperCase()
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Attendance");

            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `MotherFitness_Attendance_${dateStr}.xlsx`;

            XLSX.writeFile(wb, fileName);

            this.showNotification('success', 'Export Successful', 'Attendance data exported to Excel.');
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('error', 'Export Failed', 'Could not export data.');
        }
    }


    // Analytics Data Calculation


    // Chart Rendering
    async renderCharts() {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded');
            this.showNotification('error', 'System Error', 'Analytics module failed to load');
            return;
        }

        try {
            // Fetch data from API
            const [planData, demoData, growthData] = await Promise.all([
                this.api.getPlanPopularity(),
                this.api.getAgeDemographics(),
                this.api.getBusinessGrowth()
            ]);

            const plans = planData.data;
            const ages = demoData.data;
            const growth = growthData.data;

            // Destroy existing charts if they exist
            if (this.charts.plan) this.charts.plan.destroy();
            if (this.charts.age) this.charts.age.destroy();
            if (this.charts.growth) this.charts.growth.destroy();

            // Common Chart Options
            const commonOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: this.currentTheme === 'dark' ? '#fff' : '#333'
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: { color: this.currentTheme === 'dark' ? 'rgba(255,255,255,0.7)' : '#666' },
                        grid: { color: this.currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                    },
                    x: {
                        ticks: { color: this.currentTheme === 'dark' ? 'rgba(255,255,255,0.7)' : '#666' },
                        grid: { color: this.currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                    }
                }
            };

            const pieOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: this.currentTheme === 'dark' ? '#fff' : '#333'
                        }
                    }
                }
            };

            // 1. Plan Popularity Chart (Pie)
            const planCtx = document.getElementById('planChart').getContext('2d');
            this.charts.plan = new Chart(planCtx, {
                type: 'doughnut',
                data: {
                    labels: plans.labels,
                    datasets: [{
                        data: plans.data,
                        backgroundColor: [
                            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'
                        ],
                        borderWidth: 0
                    }]
                },
                options: pieOptions
            });

            // 2. Age Demographics Chart (Bar)
            const ageCtx = document.getElementById('ageChart').getContext('2d');
            this.charts.age = new Chart(ageCtx, {
                type: 'bar',
                data: {
                    labels: ages.labels,
                    datasets: [{
                        label: 'Number of Customers',
                        data: ages.data,
                        backgroundColor: '#4ECDC4',
                        borderRadius: 5
                    }]
                },
                options: commonOptions
            });

            // 3. Business Growth Chart (Line)
            const growthCtx = document.getElementById('growthChart').getContext('2d');
            this.charts.growth = new Chart(growthCtx, {
                type: 'line',
                data: {
                    labels: growth.labels,
                    datasets: [{
                        label: 'New Customers',
                        data: growth.data,
                        borderColor: '#FF6B6B',
                        backgroundColor: 'rgba(255, 107, 107, 0.2)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: commonOptions
            });

            // 4. Update New vs Renewing (Custom Stats)
            const statsContainer = document.getElementById('growthChart').parentElement;
            let customStats = document.getElementById('retention-stats');

            if (!customStats) {
                customStats = document.createElement('div');
                customStats.id = 'retention-stats';
                customStats.style.display = 'grid';
                customStats.style.gridTemplateColumns = '1fr 1fr';
                customStats.style.gap = '15px';
                customStats.style.marginTop = '20px';
                statsContainer.appendChild(customStats);
            }

            // Using response data passed from getDashboardStats (we need to fetch it if not available here, 
            // but for now let's use the growth data or fetch dashboard stats again)
            // Ideally we should pass 'stats' from getDashboardStats to here, but renderCharts calls getBusinessGrowth independently.
            // Let's quickly fetch dashboard stats to get the new numbers or use the numbers from the growth chart for 'New'.

            // To be accurate, we'll fetch the dashboard stats here or reuse. 
            // Since we updated getDashboardStats, let's use that.
            try {
                const dashResponse = await this.api.getDashboardStats();
                const dStats = dashResponse.data.customers;

                customStats.innerHTML = `
                    <div class="stat-card" style="padding: 15px; border-radius: 12px; background: rgba(46, 213, 115, 0.1); border: 1px solid rgba(46, 213, 115, 0.2);">
                        <h4 style="color: #2ed573; margin: 0 0 5px 0; font-size: 0.9em;">New (This Month)</h4>
                        <p style="font-size: 1.5em; font-weight: bold; margin: 0; color: var(--text-primary);">${dStats.newThisMonth || 0}</p>
                    </div>
                    <div class="stat-card" style="padding: 15px; border-radius: 12px; background: rgba(54, 162, 235, 0.1); border: 1px solid rgba(54, 162, 235, 0.2);">
                        <h4 style="color: #36a2eb; margin: 0 0 5px 0; font-size: 0.9em;">Renewals (This Month)</h4>
                        <p style="font-size: 1.5em; font-weight: bold; margin: 0; color: var(--text-primary);">${dStats.renewingThisMonth || 0}</p>
                    </div>
                `;
            } catch (e) {
                console.error("Failed to load retention stats", e);
            }

        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showNotification('error', 'Analytics Error', `Failed to load analytics data: ${error.message}`);
        }
    }

    renderCustomerCard(customer) {
        const status = customer.getStatus();
        const daysRemaining = customer.getDaysRemaining();

        let statusText = '';
        let statusClass = '';

        if (status === 'active') {
            statusText = 'Active';
            statusClass = 'active';
        } else if (status === 'expiring') {
            statusText = `${daysRemaining} days left`;
            statusClass = 'expiring';
        } else {
            statusText = 'Expired';
            statusClass = 'expired';
        }

        const validityDate = new Date(customer.validity).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        // Safe check for memberId
        const memberIdDisplay = customer.memberId || 'Pending';

        const photoHtml = customer.photo
            ? `<img src="${customer.photo}" alt="${this.escapeHtml(customer.name)}" class="customer-photo" onclick="app.openImageModal({photo: '${customer.photo}', customerId: '${customer.id}'}, 'customer')">`
            : `<div class="customer-photo-placeholder">👤</div>`;

        return `
            <div class="customer-card ${statusClass}">
                <div class="customer-header">
                    <div>
                        ${photoHtml}
                        <h3 class="customer-name">${this.escapeHtml(customer.name)}</h3>
                        <div class="member-id-badge" style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.85em; display: inline-block; margin-top: 4px;">
                            ID: ${memberIdDisplay}
                        </div>
                        <span class="customer-status ${statusClass}">${statusText}</span>

                        ${customer.tempPassword ? `
                            <div class="temp-password-box" style="background: rgba(46, 213, 115, 0.15); border: 1px dashed #2ed573; border-radius: 8px; padding: 10px; margin: 12px 0; text-align: center;">
                                <div style="color: #2ed573; font-weight: bold; font-size: 1.1em; margin-bottom: 4px;">
                                    🔑 Password: ${customer.tempPassword}
                                </div>
                                <div style="font-size: 0.75em; opacity: 0.8; color: var(--text-secondary);">
                                    (Shown once - Share with member now)
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="customer-details">
                    <div class="customer-detail">
                        <span class="detail-icon">👤</span>
                        <span>${customer.age} years old</span>
                    </div>
                    <div class="customer-detail">
                        <span class="detail-icon">📧</span>
                        <span class="text-truncate" title="${this.escapeHtml(customer.email)}">${this.escapeHtml(customer.email)}</span>
                    </div>
                    <div class="customer-detail">
                        <span class="detail-icon">📱</span>
                        <span>${this.escapeHtml(customer.phone)}</span>
                    </div>
                    <div class="customer-detail">
                        <span class="detail-icon">💳</span>
                        <span>${customer.plan} Plan</span>
                    </div>
                    <div class="customer-detail">
                        <span class="detail-icon">📅</span>
                        <span>Valid until ${validityDate}</span>
                    </div>
                    <div class="customer-detail">
                        <span class="detail-icon">💰</span>
                        <span style="color: ${customer.balance > 0 ? '#FF6B6B' : '#4ECDC4'}; font-weight: bold;">
                            Balance: ₹${customer.balance || 0}
                        </span>
                    </div>
                    ${customer.notes ? `
                    <div class="customer-detail">
                        <span class="detail-icon">📝</span>
                        <span>${this.escapeHtml(customer.notes)}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="customer-actions">
                    <button class="action-btn edit" id="edit-${customer.id}">
                        <span>✏️</span>
                        Edit
                    </button>
                    <button class="action-btn payment" id="pay-${customer.id}" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);">
                        <span>💳</span>
                        Pay
                    </button>
                    <button class="action-btn delete" id="delete-${customer.id}">
                        <span>🗑️</span>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Attendance Management
    async markAttendance(customer) {
        let customerObj;
        try {
            // Check if customer is object or ID
            const customerId = customer.id || customer;
            customerObj = typeof customer === 'object' ? customer : this.customers.find(c => c.id === customer);

            await this.api.markAttendance(customerId);

            // Get status for feedback
            const status = customerObj ? customerObj.getStatus() : 'active';
            const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            // Play beep based on status
            if (status === 'expired') {
                this.playBeep('long');
                this.playVoiceAlert('Your plan got expired so, please renew it');
                this.showVisualFeedback('warning');
                this.showAttendanceSuccess(customerObj || { name: 'Member' }, time, status);
            } else {
                this.playBeep('short');
                this.showVisualFeedback('success');
                this.showAttendanceSuccess(customerObj || { name: 'Member' }, time, status);
            }

            // Always refresh attendance dashboard and stats after successful scan
            await this.renderAttendance();
            this.updateAttendanceStats();

        } catch (error) {
            console.error('Error marking attendance:', error);
            if (error.message.includes('already checked in') || error.message.includes('already marked')) {
                this.showNotification('warning', 'Already Checked In', 'Attendance already marked for today');
                this.playBeep('short');
            } else if (error.message.includes('Membership expired')) {
                this.playBeep('long');
                this.playVoiceAlert('Your plan got expired so, please renew it');
                this.showVisualFeedback('warning');

                const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                // Ensure we have a valid customer object for the modal
                const displayCustomer = customerObj || (typeof customer === 'object' ? customer : { name: 'Member' });

                this.showAttendanceSuccess(displayCustomer, time, 'expired');
                // Notification removed as the modal provides sufficient feedback
            } else {
                this.showNotification('error', 'Error', error.message);
            }
        }
    }

    async loadAttendance() {
        try {
            const response = await this.api.getAttendance();
            return response.data.attendance || [];
        } catch (error) {
            console.error('Failed to load attendance:', error);
            return [];
        }
    }



    // Beep Sound System
    initAudio() {
        if (!this.audioInitialized) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioInitialized = true;

            // Play silent buffer to unlock audio on iOS/Android
            const buffer = this.audioContext.createBuffer(1, 1, 22050);
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            source.start(0);
        } else if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    playBeep(type) {
        if (!this.audioContext) {
            this.initAudio();
        }

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        if (type === 'short') {
            // Short beep for active members (500ms, 800Hz)
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.5);
        } else {
            // Long loud beep for expired members (5s, 400Hz)
            oscillator.frequency.value = 400;
            gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 5);
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 5);
        }
    }

    playVoiceAlert(message) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    }

    showVisualFeedback(type) {
        const flash = document.createElement('div');
        flash.className = `beep - flash ${type} `;
        document.body.appendChild(flash);

        setTimeout(() => {
            flash.remove();
        }, 300);
    }

    showAttendanceSuccess(customer, time, status) {
        const modal = document.getElementById('attendance-success-modal');
        document.getElementById('attendance-member-name').textContent = customer.name;
        document.getElementById('attendance-time').textContent = `Checked in at ${time} `;

        const badge = document.getElementById('attendance-status-badge');
        badge.className = `attendance - status - badge ${status} `;
        badge.textContent = status === 'expired' ? 'EXPIRED MEMBERSHIP' :
            status === 'expiring' ? 'EXPIRING SOON' : 'ACTIVE MEMBER';

        const message = document.getElementById('attendance-message');
        if (status === 'expired') {
            message.textContent = '⚠️ Please renew membership at the front desk';
        } else if (status === 'expiring') {
            const daysLeft = customer.getDaysRemaining();
            message.textContent = `⏰ Membership expires in ${daysLeft} days`;
        } else {
            message.textContent = '✅ Have a great workout!';
        }

        modal.classList.add('show');

        // Auto close after 3 seconds
        setTimeout(() => {
            modal.classList.remove('show');
        }, 3000);
    }

    // Attendance View Management
    toggleAttendanceView() {
        this.toggleView('attendance');
    }

    renderAttendanceRecord(record) {
        // Match customer by MongoDB _id (stored as customer.id in frontend)
        const customer = this.customers.find(c => c.id === record.customerId);
        const statusIcon = record.membershipStatus === 'expired' ? '🔴' :
            record.membershipStatus === 'expiring' ? '⚠️' : '🟢';

        // Format timestamp to local time (IST) for consistent display
        const recordDate = new Date(record.timestamp);
        const formattedTime = recordDate.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        const formattedDate = recordDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        return `
            <div class="attendance-record">
                <div class="attendance-record-info">
                    <div class="attendance-record-avatar">${statusIcon}</div>
                    <div class="attendance-record-details">
                        <h4>${this.escapeHtml(record.customerName)}</h4>
                        <p>${customer ? customer.plan + ' Plan' : 'Plan Unknown'}</p>
                    </div>
                </div>
                <div class="attendance-record-time">
                    <div class="attendance-time-badge">${formattedTime}</div>
                    <p style="margin: 0; font-size: 0.875rem; color: var(--text-muted);">${formattedDate}</p>
                </div>
            </div>
            `;
    }

    async exportAttendance() {
        const attendance = await this.loadAttendance();

        if (attendance.length === 0) {
            this.showNotification('warning', 'No Data', 'No attendance records to export.');
            return;
        }

        try {
            // Prepare data for export
            const exportData = attendance.map(a => {
                const customer = this.customers.find(c => c.id === a.customerId);
                return {
                    'Date': a.date,
                    'Time': a.time,
                    'Name': a.customerName,
                    'Plan': customer ? customer.plan : 'Unknown',
                    'Email': customer ? customer.email : 'Unknown',
                    'Phone': customer ? customer.phone : 'Unknown',
                    'Membership Status': a.membershipStatus.toUpperCase()
                };
            });

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Attendance");

            // Generate filename with date
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `MotherFitness_Attendance_${dateStr}.xlsx`;

            // Save file
            XLSX.writeFile(wb, fileName);

            this.showNotification('success', 'Export Successful', 'Attendance data exported to Excel.');
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('error', 'Export Failed', 'Could not export data. See console for details.');
        }
    }

    // Hamburger Menu Management
    openHamburgerMenu() {
        document.getElementById('hamburger-menu').classList.add('show');
        document.getElementById('hamburger-backdrop').classList.add('show');
    }

    closeHamburgerMenu() {
        document.getElementById('hamburger-menu').classList.remove('show');
        document.getElementById('hamburger-backdrop').classList.remove('show');
    }

    updateMenuLabels() {
        // This method can be used for highlighting active menu items in the future
        // For now, we'll keep the labels static to avoid confusion reported during verification
    }

    // --- Notification Center Methods ---

    injectNotificationCenter() {
        const performInjection = () => {
            const headerActions = document.querySelector('.header-actions');
            if (!headerActions) {
                console.warn('GymApp: Header actions container not found! Retrying in 1s...');
                setTimeout(performInjection, 1000);
                return;
            }

            if (document.getElementById('notification-bell-btn')) return;

            console.log('GymApp: Injecting Notification Bell...');

            // Create Bell Button
            const btn = document.createElement('button');
            btn.id = 'notification-bell-btn';
            btn.className = 'notification-bell-btn';
            btn.title = 'Notifications';
            btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
            <div class="notification-badge hide" id="notif-badge"></div>
        `;
            btn.onclick = (e) => {
                e.stopPropagation();
                this.toggleNotificationDropdown();
            };

            // Insert before Hamburger
            headerActions.insertBefore(btn, headerActions.firstChild);

            // Create Dropdown Container
            const dropdown = document.createElement('div');
            dropdown.id = 'notification-dropdown';
            dropdown.className = 'notification-dropdown';
            dropdown.innerHTML = `
            <div class="notification-header">
                    <h3>Notifications</h3>
                    <button class="clear-all-btn" onclick="app.clearNotifications()">Clear All</button>
                </div>
            <div class="notification-list" id="notification-list">
                <div class="empty-notif">No new notifications</div>
            </div>
        `;

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });

            document.body.appendChild(dropdown);
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', performInjection);
        } else {
            performInjection();
        }
    }

    toggleNotificationDropdown() {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('show');
        }
    }

    addHistoryNotification(type, title, message) {
        if (!this.notifications) this.notifications = [];
        this.notifications.unshift({ type, title, message, time: new Date() });
        this.updateNotificationUI();
        this.showNotification(type, title, message);
    }

    updateNotificationUI() {
        const badge = document.getElementById('notif-badge');
        const list = document.getElementById('notification-list');
        if (!badge || !list) return;

        const count = this.notifications.length;
        badge.textContent = count;
        if (count > 0) {
            badge.classList.remove('hide');
            badge.classList.add('show');
        } else {
            badge.classList.remove('show');
            badge.classList.add('hide');
        }

        if (count === 0) {
            list.innerHTML = '<div class="empty-notif">No new notifications</div>';
            return;
        }

        list.innerHTML = this.notifications.map(n => `
            <div class="notification-item ${n.type}">
                <div class="notif-item-header">
                    <span>${n.title}</span>
                    <span class="notif-time">${n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="notif-message">${n.message}</div>
            </div>
            `).join('');
    }

    clearNotifications() {
        this.notifications = [];
        this.updateNotificationUI();
    }
    // ===================================
    // Announcement Management
    // ===================================

    toggleAnnouncementView() {
        const view = document.getElementById('announcement-view');
        const isHidden = view.style.display === 'none';

        if (isHidden) {
            view.style.display = 'block';
            this.loadAnnouncements();

            // Set default dates
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('ann-start-date').value = today;
            // Default 7 days duration
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            document.getElementById('ann-end-date').value = nextWeek.toISOString().split('T')[0];

            this.closeHamburgerMenu();
        } else {
            view.style.display = 'none';
        }
    }

    async loadAnnouncements() {
        const listContainer = document.getElementById('announcement-list');
        listContainer.innerHTML = '<p style="text-align:center;">Loading...</p>';

        try {
            const response = await this.api.getAllAnnouncements();
            this.renderAnnouncements(response.data);
        } catch (error) {
            console.error('Failed to load announcements:', error);
            listContainer.innerHTML = '<p style="color:red; text-align:center;">Failed to load announcements.</p>';
        }
    }

    renderAnnouncements(announcements) {
        const listContainer = document.getElementById('announcement-list');
        listContainer.innerHTML = '';

        if (!announcements || announcements.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:#666;">No announcements found.</p>';
            return;
        }

        announcements.forEach(ann => {
            const isActive = new Date() >= new Date(ann.startDate) && new Date() <= new Date(ann.endDate) && ann.isActive;
            const card = document.createElement('div');
            card.className = 'announcement-card';
            card.style.cssText = `
                border: 1px solid #eee;
                border-radius: 8px;
                padding: 15px;
                background: ${isActive ? '#fff' : '#f9f9f9'};
                border-left: 4px solid ${isActive ? '#2ecc71' : '#95a5a6'};
                position: relative;
                margin-bottom: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            `;

            const typeIcons = {
                'info': 'ℹ️',
                'important': '⚠️',
                'offer': '🏷️',
                'event': '🎉',
                'maintenance': '🔧'
            };

            card.innerHTML = `
                <button onclick="app.deleteAnnouncement('${ann._id}')" style="position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer; font-size: 1.2rem;" title="Delete">🗑️</button>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <span style="font-size: 1.2rem;">${typeIcons[ann.type] || 'ℹ️'}</span>
                    <h4 style="margin: 0; color: #333;">${ann.title}</h4>
                    ${isActive ? '<span style="background: #e8f8f5; color: #2ecc71; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem;">Active</span>' : '<span style="background: #f1f2f6; color: #95a5a6; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem;">Inactive</span>'}
                </div>
                <p style="margin: 5px 0 10px 0; color: #555;">${ann.message}</p>
                <div style="font-size: 0.85rem; color: #888;">
                    Duration: ${new Date(ann.startDate).toLocaleDateString()} - ${new Date(ann.endDate).toLocaleDateString()}
                </div>
            `;
            listContainer.appendChild(card);
        });
    }

    async handleAnnouncementSubmit(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        try {
            const announcementData = {
                title: document.getElementById('ann-title').value,
                message: document.getElementById('ann-message').value,
                startDate: document.getElementById('ann-start-date').value,
                endDate: document.getElementById('ann-end-date').value,
                type: document.getElementById('ann-type').value
            };

            await this.api.createAnnouncement(announcementData);

            // Reset form
            document.getElementById('announcement-form').reset();

            // Reset dates
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('ann-start-date').value = today;
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            document.getElementById('ann-end-date').value = nextWeek.toISOString().split('T')[0];

            // Refresh list
            await this.loadAnnouncements();

            this.showNotification('success', 'Published', 'Announcement posted successfully!');
        } catch (error) {
            console.error('Failed to post announcement:', error);
            this.showNotification('error', 'Error', error.message || 'Failed to post announcement');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async deleteAnnouncement(id) {
        if (!confirm('Are you sure you want to delete this announcement?')) return;

        try {
            await this.api.deleteAnnouncement(id);
            await this.loadAnnouncements();
            this.showNotification('success', 'Deleted', 'Announcement deleted');
        } catch (error) {
            console.error('Failed to delete:', error);
            this.showNotification('error', 'Error', 'Failed to delete announcement');
        }
    }

    // ==========================================
    // Admin Profile Card Feature
    // ==========================================

    toggleAdminCard() {
        const modal = document.getElementById('admin-profile-modal');
        const viewMode = document.getElementById('admin-view-mode');
        const editMode = document.getElementById('admin-edit-mode');

        if (modal.style.display === 'flex') {
            modal.style.display = 'none';
            // Reset to view mode on close
            viewMode.style.display = 'block';
            editMode.style.display = 'none';
        } else {
            modal.style.display = 'flex';
            this.loadAdminProfile();
        }
    }

    async loadAdminProfile() {
        try {
            const result = await this.api.request('/api/admin-profile');
            const profile = result.data || result;
            this.currentAdminProfile = profile; // Store for edit

            // Populate View Mode
            document.getElementById('admin-name-display').textContent = profile.name || 'Mahesh P';
            document.getElementById('admin-dob-display').textContent = profile.dateOfBirth || 'October 1990';
            document.getElementById('admin-since-display').textContent = profile.gymStartedYear || '2017';

            const photoEl = document.getElementById('admin-photo-display');
            if (profile.photo) {
                photoEl.src = profile.photo;
            } else {
                photoEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'Admin')}&background=6c5ce7&color=fff&size=200`;
            }

            // Populate Member IDs list
            const idsList = document.getElementById('admin-ids-list');
            idsList.innerHTML = '';

            const ids = profile.memberIds || [];
            // Ensure 4 slots are shown
            for (let i = 0; i < 4; i++) {
                const idDiv = document.createElement('div');
                if (ids[i]) {
                    idDiv.className = 'id-tag';
                    idDiv.textContent = ids[i];
                } else {
                    idDiv.className = 'id-tag empty';
                    idDiv.textContent = 'Empty Slot';
                }
                idsList.appendChild(idDiv);
            }

        } catch (error) {
            console.error('Failed to load admin profile:', error);
            this.showNotification('error', 'Error', 'Could not load admin profile');
        }
    }

    promptAdminEdit() {
        // Show password prompt modal
        document.getElementById('admin-password-modal').style.display = 'flex';
        document.getElementById('admin-verify-password').value = '';
        document.getElementById('admin-verify-password').focus();
    }

    async verifyAdminPassword() {
        const password = document.getElementById('admin-verify-password').value;
        if (!password) {
            this.showNotification('warning', 'Required', 'Please enter password');
            return;
        }

        try {
            await this.api.request('/api/admin-profile/verify', {
                method: 'POST',
                data: { password }
            });

            // Password verified
            document.getElementById('admin-password-modal').style.display = 'none';
            this.enableAdminEditMode(password); // Pass password to keep for save
        } catch (error) {
            console.error('Password verification failed:', error);
            this.showNotification('error', 'Access Denied', 'Incorrect password');
        }
    }

    enableAdminEditMode(password) {
        this.adminEditAuth = password; // Store temporarily for save request

        document.getElementById('admin-view-mode').style.display = 'none';
        document.getElementById('admin-edit-mode').style.display = 'block';

        const profile = this.currentAdminProfile || {};

        // Populate inputs
        document.getElementById('edit-admin-name').value = profile.name || '';
        document.getElementById('edit-admin-photo').value = profile.photo || '';
        document.getElementById('edit-admin-dob').value = profile.dateOfBirth || '';
        document.getElementById('edit-admin-year').value = profile.gymStartedYear || '';

        // Populate member IDs inputs
        this.renderAdminMemberIdInputs(profile.memberIds || []);
    }

    renderAdminMemberIdInputs(ids) {
        const container = document.getElementById('edit-member-ids-container');
        container.innerHTML = '';

        ids.forEach((id, index) => {
            const group = document.createElement('div');
            group.className = 'admin-input-group';
            group.innerHTML = `
                <input type="text" class="form-input member-id-input" value="${id}" placeholder="Member ID">
                <button type="button" class="btn btn-sm btn-danger" onclick="app.removeAdminMemberId(${index})">✕</button>
            `;
            container.appendChild(group);
        });

        // Limit to 4
        const addBtn = document.querySelector('#admin-edit-form button[onclick="app.addAdminMemberIdInput()"]');
        if (ids.length >= 4) {
            addBtn.style.display = 'none';
        } else {
            addBtn.style.display = 'inline-block';
        }
    }

    addAdminMemberIdInput() {
        const inputs = Array.from(document.querySelectorAll('.member-id-input')).map(input => input.value);
        if (inputs.length < 4) {
            inputs.push('');
            this.renderAdminMemberIdInputs(inputs);
        }
    }

    removeAdminMemberId(index) {
        const inputs = Array.from(document.querySelectorAll('.member-id-input')).map(input => input.value);
        inputs.splice(index, 1);
        this.renderAdminMemberIdInputs(inputs);
    }

    cancelAdminEdit() {
        document.getElementById('admin-edit-mode').style.display = 'none';
        document.getElementById('admin-view-mode').style.display = 'block';
        this.adminEditAuth = null;
    }

    async handleAdminPhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Show loading state
        const btn = event.target.nextElementSibling;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Uploading...';
        btn.disabled = true;

        try {
            const result = await this.api.uploadPhoto(file);

            const data = result.data || result;
            const photoUrl = data.path;

            document.getElementById('edit-admin-photo').value = photoUrl;
            this.showNotification('success', 'Image Uploaded', 'Photo URL has been updated');
        } catch (error) {
            console.error('Photo upload failed:', error);
            this.showNotification('error', 'Upload Failed', error.message || 'Could not upload photo');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    async saveAdminProfile(event) {
        event.preventDefault();

        if (!this.adminEditAuth) {
            this.showNotification('error', 'Session Expired', 'Please verify password again');
            this.cancelAdminEdit();
            return;
        }

        const memberIds = Array.from(document.querySelectorAll('.member-id-input'))
            .map(input => input.value.trim())
            .filter(id => id !== '');

        const payload = {
            name: document.getElementById('edit-admin-name').value,
            photo: document.getElementById('edit-admin-photo').value,
            dateOfBirth: document.getElementById('edit-admin-dob').value,
            gymStartedYear: parseInt(document.getElementById('edit-admin-year').value),
            memberIds: memberIds,
            password: this.adminEditAuth // Required by backend
        };

        try {
            const result = await this.api.request('/api/admin-profile', {
                method: 'PUT',
                data: payload
            });
            const updatedProfile = result.data || result;

            this.showNotification('success', 'Success', 'Admin profile updated');
            this.currentAdminProfile = updatedProfile;
            this.cancelAdminEdit(); // Go back to view
            this.loadAdminProfile(); // Refresh view

        } catch (error) {
            console.error('Failed to save profile:', error);
            this.showNotification('error', 'Error', error.response?.data?.message || 'Could not update profile');
        }
    }
}

// Global functions for modal controls
function openCustomerModal(customerId = null) {
    app.openCustomerModal(customerId);
}

function closeCustomerModal() {
    app.closeCustomerModal();
}

function closeDeleteModal() {
    app.closeDeleteModal();
}

function closeImageModal() {
    app.closeImageModal();
}


function closeCameraModal() {
    app.closeCameraModal();
}

function closePasswordModal() {
    app.closePasswordModal();
}



function closeHamburgerMenu() {
    app.closeHamburgerMenu();
}

// Initialize the app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GymApp();
    window.app = app; // Explicitly expose to window
});

