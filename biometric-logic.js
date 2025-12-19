
// ===================================
// Access Control & Hardware Integration
// ===================================

class DoorController {
    constructor() {
        this.port = null;
        this.writer = null;
        this.isConnected = false;
    }

    async connect() {
        if (!navigator.serial) {
            alert('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
            return false;
        }

        try {
            // Request a port and open a connection
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: 9600 });

            const textEncoder = new TextEncoderStream();
            const writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
            this.writer = textEncoder.writable.getWriter();

            this.isConnected = true;
            return true;
        } catch (error) {
            console.error('Failed to connect to door controller:', error);
            if (error.name !== 'NotFoundError') { // User cancelled
                alert(`Connection failed: ${error.message}`);
            }
            return false;
        }
    }

    async openDoor() {
        if (!this.isConnected || !this.writer) {
            console.warn('Door controller not connected via Serial API. Simulating open...');
            // Fallback for demo or if using a different hardware trigger method that doesn't need explicit connect
            return;
        }

        try {
            // Send signal to Arduino
            // 'O' for Open - standard convention for simple serial relays
            await this.writer.write("O");
            console.log('Door open signal sent');
        } catch (error) {
            console.error('Failed to send door signal:', error);
        }
    }
}

class BiometricSystem {
    constructor(app, doorController) {
        this.app = app;
        this.door = doorController;
        this.isListening = false;
        this.inputBuffer = '';
        this.inputTimeout = null;
        this.ui = {
            card: document.getElementById('access-card'),
            icon: document.getElementById('access-icon'),
            title: document.getElementById('access-title'),
            details: document.getElementById('access-member-info'),
            name: document.getElementById('access-member-name'),
            photo: document.getElementById('access-member-photo'),
            status: document.getElementById('access-plan-status'),
            expiry: document.getElementById('access-expiry'),
            input: document.getElementById('biometric-input')
        };

        this.setupListener();
    }

    setupListener() {
        // Method 1: Focused Input (Most reliable for Keyboard Wedges)
        if (this.ui.input) {
            this.ui.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.processInput(this.ui.input.value);
                    this.ui.input.value = ''; // Clear
                }
            });

            // Keep focus
            document.addEventListener('click', (e) => {
                if (this.isListening && document.getElementById('access-dashboard').style.display !== 'none') {
                    this.ui.input.focus();
                }
            });
        }
    }

    start() {
        this.isListening = true;
        this.resetUI();
        if (this.ui.input) setTimeout(() => this.ui.input.focus(), 100);
    }

    stop() {
        this.isListening = false;
    }

    async processInput(memberId) {
        if (!memberId) return;

        console.log('Processing Biometric ID:', memberId);
        this.setUIState('processing');

        try {
            // Find customer by Member ID (or fallback to phone/email if needed)
            // Assuming memberId corresponds to the unique ID generated for the user

            // For this implementation, we search the local Loaded Customers first for speed
            // In a large system, this should likely be a direct API call: this.app.api.findMember(memberId)

            // NOTE: The current Customer model has 'memberId'. We'll search for that.
            let customer = this.app.customers.find(c => c.memberId === memberId || c.id === memberId || c.phone === memberId);

            if (!customer) {
                // If not found locally, try API (if implemented) or show not found
                // For now, assume local sync is sufficient or basic fail
                this.denyAccess('Member not found');
                return;
            }

            // Check Validity
            const status = customer.getStatus();

            if (status === 'active' || status === 'expiring') {
                await this.grantAccess(customer);
            } else {
                this.denyAccess('Plan Expired - Renew Your Card', customer);
            }

        } catch (error) {
            console.error('Access verification logic error:', error);
            this.denyAccess('System Error');
        }
    }

    // New Grant Access Logic
    async grantAccess(customer) {
        this.setUIState('granted', customer);

        // Trigger Door
        await this.door.openDoor();

        // Log Attendance
        try {
            await this.app.api.markAttendance(customer.id);
            this.app.updateAttendanceStats();
            this.app.showNotification('success', 'Access Granted', `Welcome, ${customer.name}!`);
        } catch (error) {
            console.error('Attendance log failed:', error);
        }

        // Reset after delay
        setTimeout(() => this.resetUI(), 4000);
    }

    denyAccess(reason, customer = null) {
        this.setUIState('denied', customer, reason);

        // Play Error Sound (optional)

        // Reset after delay
        setTimeout(() => this.resetUI(), 4000);
    }

    setUIState(state, customer = null, message = '') {
        const { card, icon, title, details, name, photo, status, expiry } = this.ui;

        // Reset classes
        card.classList.remove('waiting', 'granted', 'denied');

        if (state === 'waiting') {
            card.classList.add('waiting');
            icon.textContent = '🔒';
            title.textContent = 'Waiting for Access...';
            details.style.display = 'none';
        } else if (state === 'granted') {
            card.classList.add('granted');
            icon.textContent = '🔓';
            title.textContent = 'Access Granted';

            if (customer) {
                details.style.display = 'block';
                name.textContent = customer.name;
                photo.src = customer.photo || 'assets/default-user.png'; // Make sure fallback exists
                // Handle base64 photos or paths. If empty, maybe hide or show initial
                if (!customer.photo) photo.style.display = 'none'; else photo.style.display = 'block';

                status.textContent = 'Active Member';
                status.className = 'status-badge active';
                expiry.textContent = `Valid until: ${new Date(customer.validity).toLocaleDateString()}`;
            }
        } else if (state === 'denied') {
            card.classList.add('denied');
            icon.textContent = '🚫';
            title.textContent = 'Access Denied';

            details.style.display = 'block';
            if (customer) {
                name.textContent = customer.name;
                photo.src = customer.photo || '';
                status.textContent = 'Membership Expired';
                status.className = 'status-badge expired';
                expiry.textContent = message || 'Please renew your subscription';
            } else {
                name.textContent = 'Unknown Member';
                photo.style.display = 'none';
                status.textContent = 'Invalid ID';
                status.className = 'status-badge expired';
                expiry.textContent = message;
            }
        }
    }

    resetUI() {
        this.setUIState('waiting');
        if (this.ui.input) {
            this.ui.input.value = '';
            this.ui.input.focus();
        }
    }
}
